"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function FirebaseTest() {
  const [msg, setMsg] = useState("Checking Firebase connection...");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setMsg(user ? `✅ Logged in as ${user.email}` : "✅ Firebase connected (not logged in).");
    });
    return () => unsub();
  }, []);

  return (
    <main style={{ padding: 20 }}>
      <h1>Firebase Test</h1>
      <p>{msg}</p>
    </main>
  );
}
