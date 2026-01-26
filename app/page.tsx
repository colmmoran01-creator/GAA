"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "@/lib/firebase";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth(app);
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/teams");
      } else {
        router.replace("/login");
      }
    });
    return () => unsub();
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center text-sm text-neutral-600">
      Loading…
    </main>
  );
}
