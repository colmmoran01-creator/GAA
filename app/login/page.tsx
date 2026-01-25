"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string>("");

  async function register() {
    setMsg("");
    try {
      await createUserWithEmailAndPassword(auth, email, pw);
      setMsg("✅ Account created and logged in.");
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    }
  }

  async function login() {
    setMsg("");
    try {
      await signInWithEmailAndPassword(auth, email, pw);
      setMsg("✅ Logged in.");
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    }
  }

  async function logout() {
    setMsg("");
    await signOut(auth);
    setMsg("✅ Logged out.");
  }

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h1>Login</h1>

      <label>Email</label>
      <input
        style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <label>Password</label>
      <input
        style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
      />

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={login} style={{ padding: 10, flex: 1 }}>Log in</button>
        <button onClick={register} style={{ padding: 10, flex: 1 }}>Register</button>
      </div>

      <button onClick={logout} style={{ padding: 10, width: "100%", marginTop: 10 }}>
        Log out
      </button>

      {msg && <p style={{ marginTop: 14 }}>{msg}</p>}

      <p style={{ marginTop: 18, opacity: 0.7 }}>
        Tip: password must be at least 6 characters (Firebase rule).
      </p>
    </main>
  );
}
