"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

import Header from "@/components/Header";

const MapView = dynamic(
  () => import("@/components/MapView"),
  {
    ssr: false,
  },
);

export default function MapPage() {
  return (
    <main className="min-h-screen bg-[#f1d7be] text-[#3B2F2F]">
      <Header variant="home" />

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full bg-[#F4DCDC] px-4 py-2 text-sm font-medium text-[#B85F68]">
              📍 Алматы
            </div>

            <h1 className="text-3xl font-bold">
              Предложения на карте
            </h1>

            <p className="mt-2 text-[#806E68]">
              Найди предложения SAVEAT рядом с собой.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-xl bg-[#D87979] px-5 py-3 text-sm font-semibold text-white hover:bg-[#C96868]"
          >
            ← Назад
          </Link>
        </div>

        <div
          className="overflow-hidden rounded-[32px] border border-[#DFC2AA] bg-white shadow-lg"
          style={{
            height: "650px",
            width: "100%",
          }}
        >
          <MapView />
        </div>
      </section>
    </main>
  );
}