"use client";

import Link from "next/link";

import {
  FormEvent,
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


export default function BusinessRegisterPage() {
  const router =
    useRouter();

  const {
    user,
    loading: authLoading,
    refreshUser,
  } = useAuth();

  const {
    refreshBusiness,
  } = useBusiness();

  const [
    fullName,
    setFullName,
  ] = useState("");

  const [
    phone,
    setPhone,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    businessName,
    setBusinessName,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    logoUrl,
    setLogoUrl,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);


  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    if (!user) {
      if (
        password.length < 8
      ) {
        setError(
          "Пароль должен содержать минимум 8 символов.",
        );
        return;
      }

      if (
        password !==
        confirmPassword
      ) {
        setError(
          "Пароли не совпадают.",
        );
        return;
      }
    }

    try {
      setLoading(true);

      if (user) {
        const token =
          localStorage.getItem(
            "access_token",
          );

        if (!token) {
          throw new Error(
            "Необходимо войти в аккаунт.",
          );
        }

        const response =
          await fetch(
            `${API_URL}/businesses`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify({
                  name:
                    businessName,
                  description:
                    description ||
                    null,
                  logo_url:
                    logoUrl ||
                    null,
                }),
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            typeof data.detail ===
              "string"
              ? data.detail
              : "Не удалось создать бизнес.",
          );
        }

        await refreshBusiness();

        router.replace(
          "/business/dashboard",
        );

        return;
      }

      const response =
        await fetch(
          `${API_URL}/business-auth/register`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                full_name:
                  fullName,

                phone,
                email,
                password,

                business_name:
                  businessName,

                business_description:
                  description ||
                  null,

                business_logo_url:
                  logoUrl ||
                  null,
              }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        if (
          response.status ===
            409 &&
          typeof data.detail ===
            "string" &&
          data.detail.includes(
            "Email already registered",
          )
        ) {
          throw new Error(
            "Этот email уже зарегистрирован. Войдите в SAVEAT и добавьте бизнес к существующему аккаунту.",
          );
        }

        throw new Error(
          typeof data.detail ===
            "string"
            ? data.detail
            : "Не удалось создать бизнес.",
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


  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#f1d7be]">
        <Header variant="auth" />

        <div className="p-10 text-center">
          Загружаем...
        </div>
      </main>
    );
  }


  return (
    <main className="min-h-screen bg-[#f1d7be] text-[#3B2F2F]">
      <Header variant="auth" />

      <section className="mx-auto max-w-2xl px-5 py-12">
        <div className="rounded-[32px] border border-[#DFC2AA] bg-[#FFFDF9] p-7 shadow-[0_20px_60px_rgba(91,60,44,0.10)] sm:p-9">
          <div className="mb-8">
            <div className="inline-flex rounded-full bg-[#F7DFDC] px-3 py-1.5 text-xs font-semibold text-[#BD656B]">
              SAVEAT Business
            </div>

            <h1 className="mt-4 text-3xl font-bold">
              {user
                ? "Добавить бизнес"
                : "Регистрация бизнеса"}
            </h1>

            <p className="mt-2 text-sm leading-6 text-[#806E68]">
              {user
                ? `Бизнес будет привязан к аккаунту ${user.full_name}.`
                : "Создайте аккаунт владельца и добавьте своё заведение."}
            </p>
          </div>

          <form
            onSubmit={
              handleSubmit
            }
            className="space-y-6"
          >
            {!user && (
              <div>
                <h2 className="mb-4 text-lg font-bold">
                  Владелец
                </h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(
                      event,
                    ) =>
                      setFullName(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Имя и фамилия"
                    required
                    className="rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none focus:border-[#D87979]"
                  />

                  <input
                    type="tel"
                    value={phone}
                    onChange={(
                      event,
                    ) =>
                      setPhone(
                        event.target
                          .value,
                      )
                    }
                    placeholder="+7 700 000 00 00"
                    required
                    className="rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none focus:border-[#D87979]"
                  />

                  <input
                    type="email"
                    value={email}
                    onChange={(
                      event,
                    ) =>
                      setEmail(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Email"
                    required
                    className="rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none focus:border-[#D87979]"
                  />

                  <input
                    type="password"
                    value={password}
                    onChange={(
                      event,
                    ) =>
                      setPassword(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Пароль"
                    required
                    minLength={8}
                    className="rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none focus:border-[#D87979]"
                  />

                  <input
                    type="password"
                    value={
                      confirmPassword
                    }
                    onChange={(
                      event,
                    ) =>
                      setConfirmPassword(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Повторите пароль"
                    required
                    minLength={8}
                    className="rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none focus:border-[#D87979] sm:col-span-2"
                  />
                </div>
              </div>
            )}

            <div className="border-t border-[#EADFD6] pt-6">
              <h2 className="mb-4 text-lg font-bold">
                Заведение
              </h2>

              <div className="space-y-4">
                <input
                  type="text"
                  value={businessName}
                  onChange={(
                    event,
                  ) =>
                    setBusinessName(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Название заведения"
                  required
                  className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none focus:border-[#D87979]"
                />

                <textarea
                  value={description}
                  onChange={(
                    event,
                  ) =>
                    setDescription(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Короткое описание заведения"
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none focus:border-[#D87979]"
                />

                <input
                  type="url"
                  value={logoUrl}
                  onChange={(
                    event,
                  ) =>
                    setLogoUrl(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Ссылка на логотип — необязательно"
                  className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none focus:border-[#D87979]"
                />
              </div>
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
                ? "Создаём..."
                : "Создать бизнес"}
            </button>
          </form>

          {!user && (
            <p className="mt-6 text-center text-sm text-[#806E68]">
              Уже зарегистрированы?{" "}
              <Link
                href="/business/login"
                className="font-semibold text-[#C96868] hover:underline"
              >
                Войти
              </Link>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}