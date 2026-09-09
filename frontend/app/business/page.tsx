"use client";

import Link from "next/link";

import Header from "@/components/Header";

import {
  useAuth,
} from "@/components/AuthProvider";

import {
  useBusiness,
} from "@/components/BusinessProvider";


export default function BusinessPage() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const {
    memberships,
    selectedMembership,
    loading: businessLoading,
  } = useBusiness();


  const loading =
    authLoading ||
    businessLoading;


  return (
    <main className="min-h-screen bg-[#f1d7be] text-[#3B2F2F]">
      <Header variant="auth" />

      <section className="mx-auto flex min-h-[calc(100vh-93px)] max-w-6xl items-center px-6 py-14">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit rounded-full bg-[#F7DFDC] px-4 py-2 text-sm font-semibold text-[#B85F68]">
              SAVEAT Business
            </div>

            <h1 className="mt-6 max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">
              Продавайте остатки еды,
              вместо того чтобы
              выбрасывать их.
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-8 text-[#806E68]">
              Управляйте филиалами,
              товарами, предложениями
              и заказами из одного
              кабинета SAVEAT.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#FFF8F2] p-4">
                <p className="text-2xl">
                  🍰
                </p>

                <p className="mt-2 font-semibold">
                  Меньше списаний
                </p>
              </div>

              <div className="rounded-2xl bg-[#FFF8F2] p-4">
                <p className="text-2xl">
                  💰
                </p>

                <p className="mt-2 font-semibold">
                  Доп. выручка
                </p>
              </div>

              <div className="rounded-2xl bg-[#FFF8F2] p-4">
                <p className="text-2xl">
                  📦
                </p>

                <p className="mt-2 font-semibold">
                  Удобная выдача
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-[#DFC2AA] bg-[#FFFDF9] p-7 shadow-[0_20px_60px_rgba(91,60,44,0.10)] sm:p-9">
            {loading ? (
              <div className="py-12 text-center text-[#806E68]">
                Загружаем...
              </div>
            ) : user &&
              memberships.length >
                0 &&
              selectedMembership ? (
              <>
                <p className="text-sm font-medium text-[#A18C84]">
                  Вы вошли как
                </p>

                <h2 className="mt-1 text-2xl font-bold">
                  {
                    selectedMembership
                      .business.name
                  }
                </h2>

                <div className="mt-3 inline-flex rounded-full bg-[#F7DFDC] px-3 py-1 text-xs font-semibold text-[#B85F68]">
                  {
                    selectedMembership.role
                  }
                </div>

                <Link
                  href="/business/dashboard"
                  className="mt-7 block w-full rounded-2xl bg-[#D87979] py-3.5 text-center font-semibold text-white transition hover:bg-[#C96868]"
                >
                  Открыть кабинет
                </Link>

                <Link
                  href="/business/register"
                  className="mt-3 block w-full rounded-2xl border border-[#D9C5B7] py-3.5 text-center font-semibold transition hover:bg-[#F8EEE6]"
                >
                  Добавить ещё бизнес
                </Link>
              </>
            ) : user ? (
              <>
                <h2 className="text-2xl font-bold">
                  Создайте свой бизнес
                </h2>

                <p className="mt-3 text-sm leading-6 text-[#806E68]">
                  Ваш обычный SAVEAT
                  аккаунт уже подходит.
                  Второй аккаунт создавать
                  не нужно.
                </p>

                <Link
                  href="/business/register"
                  className="mt-7 block w-full rounded-2xl bg-[#D87979] py-3.5 text-center font-semibold text-white transition hover:bg-[#C96868]"
                >
                  Создать бизнес
                </Link>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold">
                  Начать работу
                </h2>

                <p className="mt-3 text-sm leading-6 text-[#806E68]">
                  Войдите в существующий
                  бизнес-аккаунт или
                  зарегистрируйте новое
                  заведение.
                </p>

                <Link
                  href="/business/login"
                  className="mt-7 block w-full rounded-2xl bg-[#D87979] py-3.5 text-center font-semibold text-white transition hover:bg-[#C96868]"
                >
                  Войти
                </Link>

                <Link
                  href="/business/register"
                  className="mt-3 block w-full rounded-2xl border border-[#D9C5B7] py-3.5 text-center font-semibold transition hover:bg-[#F8EEE6]"
                >
                  Зарегистрировать бизнес
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}