"use client";

import { useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  // ✅ If already logged in, go straight to teams
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        window.location.href = "/teams";
      } else {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  async function login() {
    setMsg("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // redirect handled by onAuthStateChanged
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  }

  async function register() {
    setMsg("");
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // redirect handled by onAuthStateChanged
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  }

  async function forgotPassword() {
    setMsg("");
    if (!email) {
      setMsg("Please enter your email first, then click Forgot password.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setMsg(
        "Password reset email sent. Check your inbox (and spam/junk folder)."
      );
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  }

  if (loading) {
    return <main style={{ padding: 24 }}>Loading…</main>;
  }

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h1>GAA Attendance</h1>

      <label>Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", padding: 10, margin: "6px 0 14px" }}
      />

      <label>Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", padding: 10, margin: "6px 0 14px" }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={login} style={{ padding: "10px" }}>
          Log in
        </button>

        <button onClick={register} style={{ padding: "10px" }}>
          Register
        </button>

        {/* ✅ THIS IS THE FORGOT PASSWORD BUTTON */}
        <button
          onClick={forgotPassword}
          style={{ padding: "10px", background: "#eee" }}
        >
          Forgot password
        </button>
      </div>

      {msg && <p style={{ marginTop: 14 }}>{msg}</p>}

      <p style={{ marginTop: 20, fontSize: 13, opacity: 0.7 }}>
        If you were given a temporary password, log in once or click
        <strong> Forgot password</strong> to set your own.
      </p>
    </main>
  );
}
