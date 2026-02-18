"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type UserProfile = {
  uid: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  role?: "coach" | "admin";
};

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const ref = doc(db, "users", user.uid);

      const unsubProfile = onSnapshot(ref, (snap) => {
        const d = snap.exists() ? (snap.data() as any) : {};
        setProfile({
          uid: user.uid,
          email: user.email ?? d.email,
          firstName: d.firstName,
          lastName: d.lastName,
          displayName:
            d.displayName ||
            `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() ||
            user.email ||
            user.uid,
          role: d.role || "coach",
        });
        setLoading(false);
      });

      return () => unsubProfile();
    });

    return () => unsubAuth();
  }, []);

  return { profile, loading };
}
