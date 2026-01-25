"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        // ✅ LOGGED IN → GO TO TEAMS
        window.location.href = "/teams";
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  if (loading) {
    return <main style={{ padding: 24 }}>Loading…</main>;
  }

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h1>Maryland / Tang Attendance</h1>

      <p>Please log in or register to continue.</p>

      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <Link href="/login">Log in</Link>
        <Link href="/register">Register</Link>
      </div>
    </main>
  );
}
