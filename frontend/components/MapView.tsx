"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

type UserLocation = {
  lat: number;
  lng: number;
};

type Place = {
  id: number;
  business: string;
  branch: string;
  address: string;
  title: string;
  price: number;
  oldPrice: number;
  pickup: string;
  remaining: number;
  latitude: number;
  longitude: number;
};

const places: Place[] = [
  {
    id: 1,
    business: "Sweet Cake",
    branch: "Sweet Cake Abaya",
    address: "Abaya Avenue 50, Almaty",
    title: "Medovik",
    price: 1500,
    oldPrice: 2500,
    pickup: "20:00–21:00",
    remaining: 4,
    latitude: 43.2389,
    longitude: 76.8897,
  },
  {
    id: 2,
    business: "Coffee Boom",
    branch: "Coffee Boom Center",
    address: "Almaty",
    title: "Croissant Box",
    price: 1900,
    oldPrice: 3200,
    pickup: "19:30–21:00",
    remaining: 3,
    latitude: 43.2445,
    longitude: 76.9272,
  },
  {
    id: 3,
    business: "Dessert Lab",
    branch: "Dessert Lab",
    address: "Almaty",
    title: "Mystery Sweet Box",
    price: 2500,
    oldPrice: 4500,
    pickup: "20:30–22:00",
    remaining: 2,
    latitude: 43.2258,
    longitude: 76.9055,
  },
];

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

export default function MapView() {
  const [userLocation, setUserLocation] =
    useState<UserLocation | null>(null);

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] =
    useState("");

  const sortedPlaces = useMemo(() => {
    if (!userLocation) {
      return places.map((place) => ({
        ...place,
        distance: null as number | null,
      }));
    }

    return places
      .map((place) => {
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          place.latitude,
          place.longitude,
        );

        return {
          ...place,
          distance,
        };
      })
      .sort(
        (a, b) =>
          (a.distance ?? Infinity) -
          (b.distance ?? Infinity),
      );
  }, [userLocation]);

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

  function build2GisRoute(
    longitude: number,
    latitude: number,
  ) {
    return `dgis://2gis.ru/routeSearch/rsType/car/to/${longitude},${latitude}`;
  }

  return (
    <div className="relative h-full w-full">
      {/* Location button */}
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

      {/* Nearest places */}
      {userLocation && (
        <div className="absolute bottom-5 left-5 z-[1000] w-[290px] overflow-hidden rounded-2xl border border-[#E2C8B5] bg-[#FFFDF9] shadow-lg">
          <div className="border-b border-[#EEE0D5] px-4 py-3">
            <p className="text-xs font-medium text-[#C5686D]">
              SAVEAT
            </p>

            <h3 className="font-bold text-[#3B2F2F]">
              Ближайшие к вам
            </h3>
          </div>

          <div>
            {sortedPlaces.map((place, index) => (
              <div
                key={place.id}
                className="flex items-center justify-between gap-3 border-b border-[#F0E6DE] px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#4B3A3A]">
                    {index + 1}. {place.business}
                  </p>

                  <p className="truncate text-xs text-[#9A8176]">
                    {place.branch}
                  </p>
                </div>

                <span className="shrink-0 rounded-full bg-[#F7DFDC] px-2.5 py-1 text-xs font-semibold text-[#B85F68]">
                  {place.distance !== null
                    ? formatDistance(place.distance)
                    : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <MapContainer
        center={[43.2389, 76.8897]}
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

        {/* Branches */}
        {sortedPlaces.map((place) => (
          <CircleMarker
            key={place.id}
            center={[
              place.latitude,
              place.longitude,
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
                  width: "220px",
                  color: "#3B2F2F",
                }}
              >
                <div
                  style={{
                    marginBottom: "10px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#B76568",
                      fontWeight: 600,
                    }}
                  >
                    {place.business}
                  </div>

                  <div
                    style={{
                      marginTop: "2px",
                      fontSize: "17px",
                      fontWeight: 700,
                    }}
                  >
                    {place.branch}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "13px",
                    color: "#806E68",
                  }}
                >
                  📍 {place.address}
                </div>

                {place.distance !== null && (
                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "13px",
                      color: "#806E68",
                    }}
                  >
                    От вас:{" "}
                    <strong>
                      {formatDistance(
                        place.distance,
                      )}
                    </strong>
                  </div>
                )}

                <div
                  style={{
                    marginTop: "12px",
                    padding: "10px",
                    borderRadius: "12px",
                    background: "#FAF1E8",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                    }}
                  >
                    {place.title}
                  </div>

                  <div
                    style={{
                      marginTop: "5px",
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                    }}
                  >
                    <strong
                      style={{
                        fontSize: "16px",
                      }}
                    >
                      {place.price.toLocaleString()} ₸
                    </strong>

                    <span
                      style={{
                        color: "#AFA09A",
                        textDecoration: "line-through",
                        fontSize: "12px",
                      }}
                    >
                      {place.oldPrice.toLocaleString()} ₸
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: "7px",
                      fontSize: "12px",
                      color: "#806E68",
                    }}
                  >
                    🕒 {place.pickup}
                  </div>

                  <div
                    style={{
                      marginTop: "3px",
                      fontSize: "12px",
                      color: "#B85F68",
                      fontWeight: 600,
                    }}
                  >
                    Осталось: {place.remaining} шт.
                  </div>
                </div>

                <a
                  href={build2GisRoute(
                    place.longitude,
                    place.latitude,
                  )}
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

        {/* User */}
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

        <RecenterMap
          location={userLocation}
        />
      </MapContainer>
    </div>
  );
}