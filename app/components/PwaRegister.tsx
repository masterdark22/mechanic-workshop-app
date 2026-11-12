"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const isLocalDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

    if ("serviceWorker" in navigator && !isLocalDev) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Si falla la activación del SW, la app sigue funcionando con la experiencia base.
      });
    }
  }, []);

  return null;
}
