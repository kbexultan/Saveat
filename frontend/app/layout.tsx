import type {
  Metadata,
  Viewport,
} from "next";

import type {
  ReactNode,
} from "react";

import {
  Geist,
  Geist_Mono,
} from "next/font/google";

import {
  AuthProvider,
} from "@/components/AuthProvider";

import {
  BusinessProvider,
} from "@/components/BusinessProvider";

import {
  CartProvider,
} from "@/components/CartProvider";

import {
  FavoritesProvider,
} from "@/components/FavoritesProvider";

import {
  ToastProvider,
} from "@/components/ToastProvider";

import {
  NotificationsProvider,
} from "@/components/NotificationsProvider";

import {
  SubscriptionsProvider,
} from "@/components/SubscriptionsProvider";

import "leaflet/dist/leaflet.css";
import "./globals.css";


const geistSans = Geist({
  variable:
    "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono =
  Geist_Mono({
    variable:
      "--font-geist-mono",
    subsets: ["latin"],
  });


export const metadata:
  Metadata = {
  title: "SAVEAT",
  description:
    "Save food. Save money.",
};


/**
 * viewport-fit=cover обязателен: без него env(safe-area-inset-*)
 * на iPhone всегда равен нулю и плавающая навигация налезает
 * на системный индикатор.
 */
export const viewport:
  Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff7ef",
};


export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/*
          ToastProvider выше NotificationsProvider: второй показывает
          новые уведомления тостами, значит на момент его монтирования
          useToast() уже должен работать.
        */}
        <AuthProvider>
          <ToastProvider>
            <NotificationsProvider>
              <SubscriptionsProvider>
                <FavoritesProvider>
                  <BusinessProvider>
                    <CartProvider>
                      {children}
                    </CartProvider>
                  </BusinessProvider>
                </FavoritesProvider>
              </SubscriptionsProvider>
            </NotificationsProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
