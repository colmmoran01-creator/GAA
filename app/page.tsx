"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function HomePage() {
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        window.location.href = "/teams";
      } else {
        window.location.href = "/login";
      }
    });
    return () => unsub();
  }, []);

  return <main style={{ padding: 24 }}>Loading…</main>;
}
