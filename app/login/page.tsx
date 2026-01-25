"use client";

import { useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button, ButtonRow, Card, CardBody, H1, Input, Label, Muted } from "@/app/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) window.location.href = "/teams";
      else setLoading(false);
    });
    return () => unsub();
  }, []);

  async function login() {
    setMsg("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  }

  async function register() {
    setMsg("");
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  }

  async function forgotPassword() {
    setMsg("");
    if (!email) {
      setMsg("Enter your email first, then press Forgot password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setMsg("Password reset email sent. Check your inbox (and spam/junk).");
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  }

  if (loading) return <div className="py-10 text-sm text-neutral-600">Loading…</div>;

<div className="flex justify-center mb-4">
  <img
    src="/club-logo.png"
    alt="Club logo"
    className="h-16 w-16 rounded-2xl object-contain bg-white ring-1 ring-neutral-200"
  />
</div>

  return (
    <div className="py-6">
      <Card>
        <CardBody>
          <H1>GAA Attendance</H1>
          <Muted className="mt-1">Log in to manage teams, events and attendance.</Muted>

          <div className="mt-5 space-y-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
            </div>

            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            <ButtonRow>
              <Button onClick={login}>Log in</Button>
              <Button variant="secondary" onClick={register}>Register</Button>
              <Button variant="secondary" onClick={forgotPassword}>Forgot password</Button>
            </ButtonRow>

            {msg && <div className="rounded-xl bg-neutral-100 p-3 text-sm text-neutral-800">{msg}</div>}

            <div className="pt-2 text-xs text-neutral-500">
              Tip: If you were given a temporary password, use <strong>Forgot password</strong> to set your own.
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
