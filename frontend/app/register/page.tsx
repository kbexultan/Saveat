"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import Header from "@/components/Header";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: fullName,
          phone,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.detail === "Email already registered") {
          throw new Error("Пользователь с таким email уже существует.");
        }

        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Не удалось создать аккаунт.",
        );
      }

      setSuccess("Аккаунт успешно создан!");

      setFullName("");
      setPhone("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
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
      {/* Header */}
      <Header variant="auth" />

      {/* Register */}
      <section className="flex min-h-[calc(100vh-93px)] items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-[32px] border border-[#dfbea4] bg-[#fffaf5] p-7 shadow-[0_20px_60px_rgba(91,60,44,0.10)] sm:p-9">
            <div className="mb-8">
              <div className="mb-4 inline-flex rounded-full bg-[#f7dfdc] px-3 py-1.5 text-xs font-semibold text-[#bd656b]">
                Добро пожаловать в SAVEAT
              </div>

              <h2 className="text-3xl font-bold tracking-tight">
                Создать аккаунт
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#8B746C]">
                Регистрируйся и бронируй свежую еду со скидкой.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div>
                <label
                  htmlFor="fullName"
                  className="mb-2 block text-sm font-medium"
                >
                  Имя
                </label>

                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Имя"
                  required
                  className="w-full rounded-2xl border border-[#e3cfc0] bg-[#fffdf9] px-4 py-3.5 outline-none transition placeholder:text-[#b6a39a] focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
                />
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-medium"
                >
                  Номер телефона
                </label>

                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+7 700 000 00 00"
                  required
                  className="w-full rounded-2xl border border-[#e3cfc0] bg-[#fffdf9] px-4 py-3.5 outline-none transition placeholder:text-[#b6a39a] focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
                />
              </div>

              {/* Email */}
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
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full rounded-2xl border border-[#e3cfc0] bg-[#fffdf9] px-4 py-3.5 outline-none transition placeholder:text-[#b6a39a] focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
                />
              </div>

              {/* Password */}
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
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Минимум 8 символов"
                  required
                  minLength={8}
                  className="w-full rounded-2xl border border-[#e3cfc0] bg-[#fffdf9] px-4 py-3.5 outline-none transition placeholder:text-[#b6a39a] focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
                />
              </div>

              {/* Confirm password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-medium"
                >
                  Повторите пароль
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  placeholder="Повторите пароль"
                  required
                  minLength={8}
                  className="w-full rounded-2xl border border-[#e3cfc0] bg-[#fffdf9] px-4 py-3.5 outline-none transition placeholder:text-[#b6a39a] focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
                />
              </div>

              {error && (
                <div className="rounded-2xl bg-[#fbe3e1] px-4 py-3 text-sm text-[#a64f55]">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-2xl bg-[#e7f2e5] px-4 py-3 text-sm text-[#527150]">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#D87979] py-3.5 font-semibold text-white transition hover:bg-[#C96868] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Создаём аккаунт..."
                  : "Зарегистрироваться"}
              </button>
            </form>

            <div className="mt-7 text-center text-sm text-[#8B746C]">
              Уже есть аккаунт?{" "}
              <Link
                href="/login"
                className="font-semibold text-[#C96868] hover:underline"
              >
                Войти
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