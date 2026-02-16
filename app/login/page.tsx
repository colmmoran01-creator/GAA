"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Mode = "login" | "register" | "completeProfile";

function cleanName(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

export default function LoginPage() {
  const router = useRouter();
  const auth = getAuth();

  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // For register + profile completion
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // If already logged in, ensure profile exists then go Home
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        const uref = doc(db, "users", user.uid);
        const usnap = await getDoc(uref);

        if (!usnap.exists()) {
          // Ask for profile once
          setMode("completeProfile");
          setEmail(user.email ?? "");
          return;
        }

        const data = usnap.data() as any;
        if (!data?.firstName || !data?.lastName) {
          setMode("completeProfile");
          setEmail(user.email ?? "");
          setFirstName(data?.firstName ?? "");
          setLastName(data?.lastName ?? "");
          return;
        }

        router.replace("/"); // ✅ Home landing page after login
      } catch (e: any) {
        console.error(e);
        setErr(e?.message ?? String(e));
      }
    });

    return () => unsub();
  }, [auth, router]);

  async function login() {
    setLoading(true);
    setErr("");
    setMsg("");

    try {
      const res = await signInWithEmailAndPassword(auth, email.trim(), password);
      // After sign-in, the onAuthStateChanged above will route to / or request profile.
      setMsg(`Welcome ${res.user.email ?? ""}`);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function register() {
    setLoading(true);
    setErr("");
    setMsg("");

    try {
      const fn = cleanName(firstName);
      const ln = cleanName(lastName);
      if (!fn || !ln) {
        setErr("Please enter First and Last Name.");
        setLoading(false);
        return;
      }

      const res = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = res.user.uid;

      await setDoc(doc(db, "users", uid), {
        firstName: fn,
        lastName: ln,
        displayName: `${fn} ${ln}`.trim(),
        email: res.user.email ?? email.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      router.replace("/"); // ✅ go Home
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function completeProfile() {
    setLoading(true);
    setErr("");
    setMsg("");

    try {
      const user = auth.currentUser;
      if (!user) {
        setErr("Not signed in. Please log in again.");
        setLoading(false);
        return;
      }

      const fn = cleanName(firstName);
      const ln = cleanName(lastName);
      if (!fn || !ln) {
        setErr("Please enter First and Last Name.");
        setLoading(false);
        return;
      }

      await setDoc(
        doc(db, "users", user.uid),
        {
          firstName: fn,
          lastName: ln,
          displayName: `${fn} ${ln}`.trim(),
          email: user.email ?? email.trim(),
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      router.replace("/"); // ✅ go Home
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function forgotPassword() {
    setLoading(true);
    setErr("");
    setMsg("");

    try {
      if (!email.trim()) {
        setErr("Enter your email first, then click Forgot Password.");
        setLoading(false);
        return;
      }
      await sendPasswordResetEmail(auth, email.trim());
      setMsg("Password reset email sent. Check your inbox.");
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isComplete = mode === "completeProfile";

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">
              {isLogin && "Log in"}
              {isRegister && "Create account"}
              {isComplete && "Complete profile"}
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              {isLogin && "Log in to manage teams, events and attendance."}
              {isRegister && "Create an account and add your name."}
              {isComplete && "Please add your name so exports show the right coach."}
            </p>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50"
          >
            Home
          </Link>
        </div>

        {(isRegister || isComplete) && (
          <div className="mt-4 grid gap-3">
            <div>
              <label className="block text-sm font-medium text-neutral-800">First Name</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900/10"
                placeholder="e.g., Colm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-800">Last Name</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900/10"
                placeholder="e.g., Moran"
              />
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-3">
          <div>
            <label className="block text-sm font-medium text-neutral-800">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900/10"
              placeholder="name@email.com"
            />
          </div>

          {!isComplete && (
            <div>
              <label className="block text-sm font-medium text-neutral-800">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900/10"
                placeholder="••••••••"
              />
            </div>
          )}
        </div>

        {err && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}
        {msg && (
          <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            {msg}
          </div>
        )}

        <div className="mt-5 grid gap-2">
          {isLogin && (
            <>
              <button
                disabled={loading}
                onClick={login}
                className="w-full rounded-full bg-[#1E3A8A] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Working…" : "Log in"}
              </button>

              <button
                disabled={loading}
                onClick={forgotPassword}
                className="w-full rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50 disabled:opacity-50"
              >
                Forgot password
              </button>

              <button
                disabled={loading}
                onClick={() => {
                  setErr("");
                  setMsg("");
                  setMode("register");
                }}
                className="w-full rounded-full bg-[#7A0019] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                Create account
              </button>
            </>
          )}

          {isRegister && (
            <>
              <button
                disabled={loading}
                onClick={register}
                className="w-full rounded-full bg-[#7A0019] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Working…" : "Register"}
              </button>

              <button
                disabled={loading}
                onClick={() => {
                  setErr("");
                  setMsg("");
                  setMode("login");
                }}
                className="w-full rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50 disabled:opacity-50"
              >
                Back to login
              </button>
            </>
          )}

          {isComplete && (
            <button
              disabled={loading}
              onClick={completeProfile}
              className="w-full rounded-full bg-[#1E3A8A] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save name & continue"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
