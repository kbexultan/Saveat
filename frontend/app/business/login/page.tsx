"use client";

import Link from "next/link";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import Header from "@/components/Header";

import {
  useAuth,
} from "@/components/AuthProvider";

import {
  useBusiness,
} from "@/components/BusinessProvider";


const API_URL =
  process.env
    .NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8001";


export default function BusinessLoginPage() {
  const router =
    useRouter();

  const {
    user,
    loading: authLoading,
    refreshUser,
  } = useAuth();

  const {
    memberships,
    loading: businessLoading,
    refreshBusiness,
  } = useBusiness();

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");


  useEffect(() => {
    if (
      !authLoading &&
      !businessLoading &&
      user &&
      memberships.length > 0
    ) {
      router.replace(
        "/business/dashboard",
      );
    }
  }, [
    authLoading,
    businessLoading,
    user,
    memberships.length,
    router,
  ]);


  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    try {
      setLoading(true);

      const response =
        await fetch(
          `${API_URL}/business-auth/login`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                email,
                password,
              }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        if (
          response.status ===
          401
        ) {
          throw new Error(
            "Неверный email или пароль.",
          );
        }

        if (
          response.status ===
          403
        ) {
          throw new Error(
            "У этого аккаунта пока нет бизнеса в SAVEAT.",
          );
        }

        throw new Error(
          typeof data.detail ===
            "string"
            ? data.detail
            : "Не удалось войти.",
        );
      }

      localStorage.setItem(
        "access_token",
        data.access_token,
      );

      await refreshUser();
      await refreshBusiness();

      router.replace(
        "/business/dashboard",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Произошла ошибка.",
      );
    } finally {
      setLoading(false);
    }
  }


  return (
    <main className="min-h-screen bg-[#f1d7be] text-[#3B2F2F]">
      <Header variant="auth" />

      <section className="flex min-h-[calc(100vh-93px)] items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-[32px] border border-[#DFC2AA] bg-[#FFFDF9] p-8 shadow-[0_20px_60px_rgba(91,60,44,0.10)]">
            <div className="mb-7">
              <div className="inline-flex rounded-full bg-[#F7DFDC] px-3 py-1.5 text-xs font-semibold text-[#BD656B]">
                SAVEAT Business
              </div>

              <h1 className="mt-4 text-3xl font-bold">
                Вход для бизнеса
              </h1>

              <p className="mt-2 text-sm leading-6 text-[#806E68]">
                Используйте email и пароль
                вашего SAVEAT аккаунта.
              </p>
            </div>

            <form
              onSubmit={
                handleSubmit
              }
              className="space-y-5"
            >
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium"
                >
                  Email
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target
                        .value,
                    )
                  }
                  autoComplete="email"
                  required
                  placeholder="owner@example.com"
                  className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none transition focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium"
                >
                  Пароль
                </label>

                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target
                        .value,
                    )
                  }
                  autoComplete="current-password"
                  required
                  className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none transition focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
                />
              </div>

              {error && (
                <div className="rounded-2xl bg-[#FBE3E1] px-4 py-3 text-sm text-[#A64F55]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#D87979] py-3.5 font-semibold text-white transition hover:bg-[#C96868] disabled:opacity-60"
              >
                {loading
                  ? "Входим..."
                  : "Войти в кабинет"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[#806E68]">
              Нет бизнеса?{" "}
              <Link
                href="/business/register"
                className="font-semibold text-[#C96868] hover:underline"
              >
                Зарегистрировать
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}