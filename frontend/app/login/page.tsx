"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import Header from "@/components/Header";
import { useAuth } from "@/components/AuthProvider";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.detail === "Invalid email or password") {
          throw new Error("Неверный email или пароль.");
        }

        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Не удалось войти в аккаунт.",
        );
      }

      localStorage.setItem(
        "access_token",
        data.access_token,
      );

      await refreshUser();

      router.push("/");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Произошла неизвестная ошибка.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f1d7be] text-[#3B2F2F]">
      <Header variant="auth" />

      <section className="flex min-h-[calc(100vh-93px)] items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-[32px] border border-[#dfbea4] bg-[#fffaf5] p-7 shadow-[0_20px_60px_rgba(91,60,44,0.10)] sm:p-9">
            <div className="mb-8">
              <div className="mb-4 inline-flex rounded-full bg-[#f7dfdc] px-3 py-1.5 text-xs font-semibold text-[#bd656b]">
                С возвращением
              </div>

              <h1 className="text-3xl font-bold tracking-tight">
                Войти в аккаунт
              </h1>

              <p className="mt-2 text-sm leading-6 text-[#8B746C]">
                Войди, чтобы бронировать предложения и смотреть свои заказы.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
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
                    setEmail(event.target.value)
                  }
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                  className="w-full rounded-2xl border border-[#e3cfc0] bg-[#fffdf9] px-4 py-3.5 outline-none transition placeholder:text-[#b6a39a] focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
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
                    setPassword(event.target.value)
                  }
                  placeholder="Введите пароль"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-2xl border border-[#e3cfc0] bg-[#fffdf9] px-4 py-3.5 outline-none transition placeholder:text-[#b6a39a] focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
                />
              </div>

              {error && (
                <div className="rounded-2xl bg-[#fbe3e1] px-4 py-3 text-sm text-[#a64f55]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#D87979] py-3.5 font-semibold text-white transition hover:bg-[#C96868] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Входим..." : "Войти"}
              </button>
            </form>

            <div className="mt-7 text-center text-sm text-[#8B746C]">
              Нет аккаунта?{" "}
              <Link
                href="/register"
                className="font-semibold text-[#C96868] hover:underline"
              >
                Зарегистрироваться
              </Link>
            </div>
          </div>

          <div className="mt-7 text-center">
            <p className="font-bold tracking-wide text-[#D87979]">
              SAVEAT
            </p>

            <p className="mt-1 text-xs text-[#9A7869]">
              Save food. Save money.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}