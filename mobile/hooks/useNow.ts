"use client";

import { useEffect, useState } from "react";

/** Refresh time-based controls on an open screen; the API remains authoritative. */
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
