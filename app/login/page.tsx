"use client";

import { useEffect, useState } from "react";
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) window.location.href = "/teams";
    });
    return () => unsub();
  }, []);

  async function login() {
    setMsg("");
    try {
      await signInWithEmailAndPassword(auth, email, pw);
      // redirect happens via onAuthStateChanged
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  }

  async function register() {
    setMsg("");
    try {
      await createUserWithEmailAndPassword(auth, email, pw);
      // redirect happens via onAuthStateChanged
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  }

  async function logout() {
    await signOut(auth);
    setMsg("Logged out.");
  }

  return (
    <main style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1>Login</h1>

      <label>Email</label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", padding: 10, margin: "6px 0 14px" }}
      />

      <label>Password</label>
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        style={{ width: "100%", padding: 10, margin: "6px 0 14px" }}
      />

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={login} style={{ padding: "10px 14px" }}>Log in</button>
        <button onClick={register} style={{ padding: "10px 14px" }}>Register</button>
        <button onClick={logout} style={{ padding: "10px 14px" }}>Log out</button>
      </div>

      {msg && <p style={{ marginTop: 14 }}>{msg}</p>}

      <p style={{ marginTop: 18, opacity: 0.7 }}>
        Tip: password must be at least 6 characters (Firebase rule).
      </p>
    </main>
  );
}
