"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import type { CircleMarker as LeafletCircleMarker } from "leaflet";

import type { Offer } from "@/components/OfferCard";

import {
  formatPickupWindow,
  formatPrice,
} from "@/lib/offers";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";

/** Центр Алматы: запасная позиция, пока нечего показывать. */
const ALMATY_CENTER: [number, number] = [43.2389, 76.8897];

type UserLocation = {
  lat: number;
  lng: number;
};

type BranchPoint = {
  id: string;
  businessName: string;
  branchName: string;
  address: string;
  latitude: number;
  longitude: number;
  offers: Offer[];
};

/**
 * Собирает предложения в точки выдачи: на карте нужен один маркер на
 * заведение, а не по маркеру на каждое предложение — иначе три оффера
 * одной пекарни рисуются поверх друг друга в одной координате.
 */
function groupByBranch(offers: Offer[]): BranchPoint[] {
  const points = new Map<string, BranchPoint>();

  for (const offer of offers) {
    // latitude/longitude в модели точки необязательные. Без координат
    // маркер поставить некуда, поэтому такие предложения на карту не
    // попадают — в каталоге они при этом остаются видимыми.
    if (
      typeof offer.latitude !== "number" ||
      typeof offer.longitude !== "number"
    ) {
      continue;
    }

    const existing = points.get(offer.branch_id);

    if (existing) {
      existing.offers.push(offer);
      continue;
    }

    points.set(offer.branch_id, {
      id: offer.branch_id,
      businessName: offer.business_name,
      branchName: offer.branch_name,
      address: offer.address,
      latitude: offer.latitude,
      longitude: offer.longitude,
      offers: [offer],
    });
  }

  return [...points.values()];
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const earthRadiusKm = 6371;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c =
    2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function formatDistance(distanceKm: number) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} м`;
  }

  return `${distanceKm.toFixed(1)} км`;
}

function build2GisRoute(
  longitude: number,
  latitude: number,
) {
  /*
    Раньше здесь был deep link dgis://, который открывается только при
    установленном приложении: на десктопе такая ссылка молча ничего не
    делает. Веб-версия работает везде, а на телефоне её перехватывает
    установленное приложение.
  */
  return (
    "https://2gis.kz/almaty/directions/points/" +
    `%7C${longitude}%2C${latitude}`
  );
}

function RecenterMap({
  location,
}: {
  location: UserLocation | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!location) {
      return;
    }

    map.flyTo(
      [location.lat, location.lng],
      15,
      {
        duration: 1,
      },
    );
  }, [location, map]);

  return null;
}

type FocusRequest = {
  branchId: string;
  /** Метка времени: нужна, чтобы повторный клик по той же точке сработал. */
  requestedAt: number;
};

/**
 * Перелёт к точке по клику в списке.
 *
 * Живёт внутри MapContainer, потому что useMap() доступен только
 * потомкам карты, а список отрисован снаружи — поверх неё.
 */
function FocusBranch({
  request,
  branches,
  markersRef,
}: {
  request: FocusRequest | null;
  branches: BranchPoint[];
  markersRef: React.RefObject<
    Map<string, LeafletCircleMarker>
  >;
}) {
  const map = useMap();

  useEffect(() => {
    if (!request) {
      return;
    }

    const branch = branches.find(
      (item) => item.id === request.branchId,
    );

    if (!branch) {
      return;
    }

    const marker = markersRef.current?.get(branch.id);

    const target: [number, number] = [
      branch.latitude,
      branch.longitude,
    ];

    // Ближе не подъезжаем, если пользователь уже приблизил карту сам.
    const targetZoom = Math.max(map.getZoom(), 16);

    const alreadyThere =
      map.getZoom() === targetZoom &&
      map.getCenter().distanceTo(target) < 1;

    if (alreadyThere) {
      marker?.openPopup();
      return;
    }

    /*
      Попап открываем только после перелёта. Если открыть сразу,
      Leaflet начнёт автоматически подвигать карту, чтобы попап
      поместился в окно, и это подерётся с анимацией flyTo.
    */
    function handleMoveEnd() {
      marker?.openPopup();
    }

    map.once("moveend", handleMoveEnd);

    map.flyTo(target, targetZoom, {
      duration: 0.8,
    });

    return () => {
      map.off("moveend", handleMoveEnd);
    };
  }, [request, branches, map, markersRef]);

  return null;
}

/** Подгоняет масштаб под точки, пока пользователь не нашёл себя сам. */
function FitToBranches({
  branches,
  enabled,
}: {
  branches: BranchPoint[];
  enabled: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!enabled || branches.length === 0) {
      return;
    }

    if (branches.length === 1) {
      map.setView(
        [branches[0].latitude, branches[0].longitude],
        15,
      );

      return;
    }

    map.fitBounds(
      branches.map(
        (branch) =>
          [branch.latitude, branch.longitude] as [
            number,
            number,
          ],
      ),
      {
        padding: [48, 48],
      },
    );
  }, [branches, enabled, map]);

  return null;
}

export default function MapView() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [offersError, setOffersError] = useState("");

  const [userLocation, setUserLocation] =
    useState<UserLocation | null>(null);

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] =
    useState("");

  const [focusRequest, setFocusRequest] =
    useState<FocusRequest | null>(null);

  // Ссылки на маркеры: по ним открываем попап точки, выбранной в списке.
  const markersRef = useRef(
    new Map<string, LeafletCircleMarker>(),
  );

  const focusBranch = useCallback((branchId: string) => {
    setFocusRequest({
      branchId,
      requestedAt: Date.now(),
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadOffers() {
      setLoadingOffers(true);
      setOffersError("");

      try {
        const response = await fetch(
          `${API_URL}/offers/public`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error(
            `Request failed: ${response.status}`,
          );
        }

        const data: Offer[] = await response.json();

        if (!cancelled) {
          setOffers(data);
        }
      } catch (error) {
        console.error(
          "Failed to load offers for map:",
          error,
        );

        if (!cancelled) {
          setOffersError(
            "Не удалось загрузить предложения.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingOffers(false);
        }
      }
    }

    void loadOffers();

    return () => {
      cancelled = true;
    };
  }, []);

  const branches = useMemo(
    () => groupByBranch(offers),
    [offers],
  );

  const sortedBranches = useMemo(() => {
    if (!userLocation) {
      return branches.map((branch) => ({
        ...branch,
        distance: null as number | null,
      }));
    }

    return branches
      .map((branch) => ({
        ...branch,
        distance: calculateDistance(
          userLocation.lat,
          userLocation.lng,
          branch.latitude,
          branch.longitude,
        ),
      }))
      .sort(
        (a, b) =>
          (a.distance ?? Infinity) -
          (b.distance ?? Infinity),
      );
  }, [branches, userLocation]);

  function findMyLocation() {
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError(
        "Ваш браузер не поддерживает геолокацию.",
      );
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });

        setLocating(false);
      },

      (error) => {
        setLocating(false);

        if (error.code === error.PERMISSION_DENIED) {
          setLocationError(
            "Разрешите доступ к местоположению в браузере.",
          );
          return;
        }

        if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError(
            "Не удалось определить местоположение.",
          );
          return;
        }

        if (error.code === error.TIMEOUT) {
          setLocationError(
            "Определение местоположения заняло слишком много времени.",
          );
          return;
        }

        setLocationError(
          "Не удалось получить местоположение.",
        );
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      },
    );
  }

  const hasLocation = userLocation !== null;

  return (
    <div className="relative h-full w-full">
      {/* Кнопка геолокации */}
      <div className="absolute right-4 top-4 z-[1000] flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={findMyLocation}
          disabled={locating}
          className="rounded-2xl border border-[#E2C8B5] bg-[#FFFDF9] px-4 py-3 text-sm font-semibold text-[#5C4949] shadow-md transition hover:bg-[#F7E7E1] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {locating
            ? "Определяем..."
            : userLocation
              ? "✓ Местоположение найдено"
              : "📍 Моё местоположение"}
        </button>

        {locationError && (
          <div className="max-w-64 rounded-xl bg-[#FFFDF9] px-3 py-2 text-xs text-[#B55F64] shadow-md">
            {locationError}
          </div>
        )}
      </div>

      {/* Состояние загрузки и ошибки данных */}
      {(loadingOffers || offersError) && (
        <div className="absolute left-1/2 top-4 z-[1000] -translate-x-1/2 rounded-xl bg-[#FFFDF9] px-4 py-2 text-sm font-semibold text-[#5C4949] shadow-md">
          {loadingOffers
            ? "Загружаем предложения…"
            : offersError}
        </div>
      )}

      {!loadingOffers &&
        !offersError &&
        branches.length === 0 && (
          <div className="absolute left-1/2 top-4 z-[1000] -translate-x-1/2 rounded-xl bg-[#FFFDF9] px-4 py-2 text-sm font-semibold text-[#5C4949] shadow-md">
            Сейчас нет активных предложений
          </div>
        )}

      {/* Список точек: показываем и без геолокации, иначе кликать не по чему */}
      {sortedBranches.length > 0 && (
        <div className="absolute bottom-5 left-5 z-[1000] w-[290px] max-w-[calc(100%-2.5rem)] overflow-hidden rounded-2xl border border-[#E2C8B5] bg-[#FFFDF9] shadow-lg">
          <div className="border-b border-[#EEE0D5] px-4 py-3">
            <p className="text-xs font-medium text-[#C5686D]">
              SAVEAT
            </p>

            <h3 className="font-bold text-ink">
              {hasLocation
                ? "Ближайшие к вам"
                : "Точки выдачи"}
            </h3>

            <p className="mt-0.5 text-xs text-[#9A8176]">
              Нажмите, чтобы показать на карте
            </p>
          </div>

          <div className="max-h-[232px] overflow-y-auto">
            {sortedBranches.map((branch, index) => (
              <button
                key={branch.id}
                type="button"
                onClick={() => focusBranch(branch.id)}
                aria-label={`Показать на карте: ${branch.businessName}, ${branch.address}`}
                className="flex w-full items-center justify-between gap-3 border-b border-[#F0E6DE] px-4 py-3 text-left transition last:border-b-0 hover:bg-[#F9EFE9] focus:bg-[#F9EFE9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D87979]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#4B3A3A]">
                    {index + 1}. {branch.businessName}
                  </p>

                  <p className="truncate text-xs text-[#9A8176]">
                    {branch.address}
                  </p>
                </div>

                {branch.distance !== null ? (
                  <span className="shrink-0 rounded-full bg-[#F7DFDC] px-2.5 py-1 text-xs font-semibold text-[#B85F68]">
                    {formatDistance(branch.distance)}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-[#F7DFDC] px-2.5 py-1 text-xs font-semibold text-[#B85F68]">
                    {branch.offers.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <MapContainer
        center={ALMATY_CENTER}
        zoom={13}
        scrollWheelZoom
        style={{
          height: "100%",
          width: "100%",
        }}
      >
        <TileLayer
          attribution="© OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {sortedBranches.map((branch) => (
          <CircleMarker
            key={branch.id}
            ref={(instance) => {
              if (instance) {
                markersRef.current.set(
                  branch.id,
                  instance,
                );
              } else {
                markersRef.current.delete(branch.id);
              }
            }}
            center={[
              branch.latitude,
              branch.longitude,
            ]}
            radius={11}
            pathOptions={{
              color: "#C96868",
              fillColor: "#D87979",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Popup minWidth={250}>
              <div
                style={{
                  width: "230px",
                  color: "#3B2F2F",
                }}
              >
                <div style={{ marginBottom: "10px" }}>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#B76568",
                      fontWeight: 600,
                    }}
                  >
                    {branch.businessName}
                  </div>

                  <div
                    style={{
                      marginTop: "2px",
                      fontSize: "17px",
                      fontWeight: 700,
                    }}
                  >
                    {branch.branchName}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "13px",
                    color: "#806E68",
                  }}
                >
                  📍 {branch.address}
                </div>

                {branch.distance !== null && (
                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "13px",
                      color: "#806E68",
                    }}
                  >
                    От вас:{" "}
                    <strong>
                      {formatDistance(branch.distance)}
                    </strong>
                  </div>
                )}

                {/* Предложения точки: их может быть несколько,
                    поэтому список скроллится внутри попапа. */}
                <div
                  style={{
                    marginTop: "12px",
                    maxHeight: "210px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {branch.offers.map((offer) => (
                    <div
                      key={offer.id}
                      style={{
                        padding: "10px",
                        borderRadius: "12px",
                        background: "#FAF1E8",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>
                        {offer.product_name ?? offer.title}
                      </div>

                      <div
                        style={{
                          marginTop: "5px",
                          display: "flex",
                          alignItems: "center",
                          gap: "7px",
                        }}
                      >
                        <strong style={{ fontSize: "16px" }}>
                          {formatPrice(offer.sale_price)}
                        </strong>

                        <span
                          style={{
                            color: "#AFA09A",
                            textDecoration: "line-through",
                            fontSize: "12px",
                          }}
                        >
                          {formatPrice(offer.original_price)}
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: "7px",
                          fontSize: "12px",
                          color: "#806E68",
                        }}
                      >
                        🕒{" "}
                        {formatPickupWindow(
                          offer.pickup_start,
                          offer.pickup_end,
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: "3px",
                          fontSize: "12px",
                          color: "#B85F68",
                          fontWeight: 600,
                        }}
                      >
                        Осталось: {offer.quantity_remaining} шт.
                      </div>
                    </div>
                  ))}
                </div>

                <a
                  href={build2GisRoute(
                    branch.longitude,
                    branch.latitude,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    marginTop: "12px",
                    padding: "10px 12px",
                    borderRadius: "12px",
                    background: "#D87979",
                    color: "white",
                    textAlign: "center",
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: "13px",
                  }}
                >
                  Построить маршрут в 2GIS
                </a>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Пользователь */}
        {userLocation && (
          <CircleMarker
            center={[
              userLocation.lat,
              userLocation.lng,
            ]}
            radius={9}
            pathOptions={{
              color: "#3B2F2F",
              fillColor: "#FFFDF9",
              fillOpacity: 1,
              weight: 4,
            }}
          >
            <Popup>
              <strong>Вы здесь</strong>
            </Popup>
          </CircleMarker>
        )}

        <FitToBranches
          branches={branches}
          enabled={!userLocation && focusRequest === null}
        />

        <RecenterMap location={userLocation} />

        <FocusBranch
          request={focusRequest}
          branches={branches}
          markersRef={markersRef}
        />
      </MapContainer>
    </div>
  );
}
