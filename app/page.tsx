"use client";

import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

export default function HomePage() {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
  const unsub = onAuthStateChanged(auth, (user) => {
    setLoggedIn(!!user);
    setReady(true);

    // Redirect logged-in users to Teams
    if (user) {
      window.location.href = "/teams";
    }
  });
  return () => unsub();
}, []);


  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Maryland / Tang Attendance</h1>
      <p style={{ opacity: 0.8, marginTop: 0 }}>
        Track training & match attendance, capture scores, and export committee reports.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
        {!ready && <p>Loading…</p>}

        {ready && !loggedIn && (
          <>
            <Link
              href="/login"
              style={{
                display: "inline-block",
                padding: "10px 14px",
                border: "1px solid #ccc",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Login / Register
            </Link>

            <Link
              href="/about"
              style={{
                display: "inline-block",
                padding: "10px 14px",
                border: "1px solid #ccc",
                borderRadius: 10,
                textDecoration: "none",
              }}
            >
              What is this?
            </Link>
          </>
        )}

        {ready && loggedIn && (
          <>
            <Link
              href="/teams"
              style={{
                display: "inline-block",
                padding: "10px 14px",
                border: "1px solid #ccc",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Go to Teams
            </Link>

            <Link
              href="/admin"
              style={{
                display: "inline-block",
                padding: "10px 14px",
                border: "1px solid #ccc",
                borderRadius: 10,
                textDecoration: "none",
              }}
            >
              Admin Reports
            </Link>
          </>
        )}
      </div>

      <hr style={{ margin: "24px 0" }} />

      <ul style={{ lineHeight: 1.8, margin: 0, paddingLeft: 18, opacity: 0.9 }}>
        <li>Create Training / Match / Challenge events</li>
        <li>Mark attendance (Present/Absent/Late/Injured + reasons)</li>
        <li>Capture match scores</li>
        <li>Export CSV reports (matrix + totals)</li>
      </ul>
    </main>
  );
}
