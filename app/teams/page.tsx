"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import AppShell from "../components/AppShell";

type Team = {
  id: string;
  name: string;
};

const ROYAL = "#1E3A8A";
const MAROON = "#7A0019";

export default function TeamsPage() {
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        window.location.href = "/login";
        return;
      }
      setUid(u.uid);

      try {
        setLoading(true);
        setMsg("");

        // Teams where user is a coach OR admin
        const qCoach = query(collection(db, "teams"), where("coachUids", "array-contains", u.uid));
        const qAdmin = query(collection(db, "teams"), where("adminUids", "array-contains", u.uid));

        const [snapCoach, snapAdmin] = await Promise.all([getDocs(qCoach), getDocs(qAdmin)]);

        const map = new Map<string, Team>();

        snapCoach.forEach((d) => {
          const data = d.data() as any;
          map.set(d.id, { id: d.id, name: data.name || "Team" });
        });
        snapAdmin.forEach((d) => {
          const data = d.data() as any;
          map.set(d.id, { id: d.id, name: data.name || "Team" });
        });

        const list = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
        setTeams(list);
      } catch (e: any) {
        console.error(e);
        setMsg(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  return (
    <AppShell title="Teams">
      {loading && <div className="py-10 text-sm text-neutral-600">Loading teams…</div>}

      {!loading && msg && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-800">
          {msg}
        </div>
      )}

      {!loading && !msg && teams.length === 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-sm font-semibold">No teams assigned</div>
          <div className="mt-1 text-sm text-neutral-600">
            Your UID is <span className="font-mono text-xs">{uid}</span>. Add this to <strong>coachUids</strong> or{" "}
            <strong>adminUids</strong> in Firestore for the team.
          </div>
        </div>
      )}

      {!loading && teams.length > 0 && (
        <div className="grid gap-3">
          {teams.map((t) => (
            <Link
              key={t.id}
              href={`/team/${t.id}`}
              className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-semibold">{t.name}</div>
                  <div className="mt-1 text-sm text-neutral-600">Tap to view players & events</div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: ROYAL }}
                  >
                    Open
                  </span>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: MAROON }}
                  >
                    Coach
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
