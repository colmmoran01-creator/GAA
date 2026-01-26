"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth(); // uses default firebase app
    const unsub = onAuthStateChanged(auth, (user) => {
      router.replace(user ? "/teams" : "/login");
    });
    return () => unsub();
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center text-sm text-neutral-600">
      Loading…
    </main>
  );
}
