"use client";

import Header from "@/components/Header";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  function handleLogout() {
    logout();
    router.push("/");
  }

  /*
    Это будет видно в основном только если человек
    открыл /profile напрямую после перезагрузки браузера.

    При переходе с главной user уже находится
    в AuthProvider и профиль появится сразу.
  */
  if (loading) {
    return (
      <main className="min-h-screen bg-[#f1d7be] text-[#3B2F2F]">
        <Header variant="home" />

        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="h-[430px] animate-pulse rounded-[32px] border border-[#DFC2AA] bg-[#FFFAF5]" />

            <div className="space-y-6">
              <div className="h-56 animate-pulse rounded-[28px] border border-[#DFC2AA] bg-[#FFFAF5]" />

              <div className="h-48 animate-pulse rounded-[28px] border border-[#DFC2AA] bg-[#FFFAF5]" />
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const firstLetter =
    user.full_name?.trim().charAt(0).toUpperCase() || "?";

  return (
    <main className="min-h-screen bg-[#f1d7be] text-[#3B2F2F]">
      <Header variant="home" />

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          {/* Profile */}
          <div className="rounded-[32px] border border-[#DFC2AA] bg-[#FFFAF5] p-8 shadow-[0_20px_60px_rgba(91,60,44,0.08)]">
            <div className="flex items-center gap-5 border-b border-[#EADFD6] pb-7">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#D87979] text-3xl font-bold text-white">
                {firstLetter}
              </div>

              <div>
                <p className="text-sm font-medium text-[#C5686D]">
                  Мой профиль
                </p>

                <h1 className="mt-1 text-3xl font-bold">
                  {user.full_name}
                </h1>

                <p className="mt-1 text-sm text-[#8B746C]">
                  Пользователь SAVEAT
                </p>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-xl font-bold">
                Личная информация
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#FAEFE4] p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#A2877C]">
                    Имя
                  </p>

                  <p className="mt-2 font-semibold">
                    {user.full_name}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#FAEFE4] p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#A2877C]">
                    Email
                  </p>

                  <p className="mt-2 break-words font-semibold">
                    {user.email ?? "Не указан"}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#FAEFE4] p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#A2877C]">
                    Телефон
                  </p>

                  <p className="mt-2 font-semibold">
                    {user.phone ?? "Не указан"}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#FAEFE4] p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#A2877C]">
                    Статус аккаунта
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#7BAA74]" />

                    <p className="font-semibold text-[#5E8259]">
                      Активен
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="space-y-6">
            <div className="rounded-[28px] border border-[#DFC2AA] bg-[#FFFAF5] p-6 shadow-[0_15px_45px_rgba(91,60,44,0.07)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#C5686D]">
                    SAVEAT
                  </p>

                  <h2 className="mt-1 text-xl font-bold">
                    Мои заказы
                  </h2>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F7DFDC] text-xl">
                  🛍️
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-[#8B746C]">
                Активные и прошлые бронирования будут находиться
                на отдельной странице.
              </p>

              <button
                disabled
                className="mt-5 w-full cursor-not-allowed rounded-2xl bg-[#E5B0AF] py-3 text-sm font-semibold text-white"
              >
                Мои заказы
              </button>

              <p className="mt-2 text-center text-xs text-[#A58C81]">
                Скоро подключим
              </p>
            </div>

            <div className="rounded-[28px] border border-[#DFC2AA] bg-[#FFFAF5] p-6 shadow-[0_15px_45px_rgba(91,60,44,0.07)]">
              <h2 className="text-lg font-bold">
                Аккаунт
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#8B746C]">
                Выйти из текущего аккаунта на этом устройстве.
              </p>

              <button
                onClick={handleLogout}
                className="mt-5 w-full rounded-2xl border border-[#D8B7A9] bg-[#FFFDF9] py-3 text-sm font-semibold text-[#B55F64] transition hover:bg-[#F9E7E3]"
              >
                Выйти из аккаунта
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}