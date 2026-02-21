"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import AppShell from "../components/AppShell";

type Team = { id: string; name: string; coachNames?: string[] };

const ROYAL = "#1E3A8A";
const MAROON = "#7A0019";

function buildDisplayName(userDoc: any, fallbackEmail?: string | null, fallbackUid?: string) {
  const display = String(userDoc?.displayName ?? "").trim();
  const first = String(userDoc?.firstName ?? "").trim();
  const last = String(userDoc?.lastName ?? "").trim();
  const full = `${first} ${last}`.trim();

  return display || full || (fallbackEmail ?? "") || fallbackUid || "Unknown user";
}

export default function TeamsPage() {
  const [loading, setLoading] = useState(true);

  const [uid, setUid] = useState("");
  const [userLabel, setUserLabel] = useState(""); // ✅ name/email to display

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

        // ✅ Fetch user profile for friendly display label
        const uSnap = await getDoc(doc(db, "users", u.uid));
        if (uSnap.exists()) {
          const data = uSnap.data() as any;
          setUserLabel(buildDisplayName(data, u.email, u.uid));
        } else {
          setUserLabel(u.email || u.uid);
        }

        // Teams where user is a coach OR admin
        const qCoach = query(
          collection(db, "teams"),
          where("coachUids", "array-contains", u.uid)
        );
        const qAdmin = query(
          collection(db, "teams"),
          where("adminUids", "array-contains", u.uid)
        );

        const [snapCoach, snapAdmin] = await Promise.all([
          getDocs(qCoach),
          getDocs(qAdmin),
        ]);

        const map = new Map<string, Team>();

        snapCoach.forEach((d) => {
          const data = d.data() as any;
          map.set(d.id, { id: d.id, name: data.name || "Team" });
        });
        snapAdmin.forEach((d) => {
          const data = d.data() as any;
          map.set(d.id, { id: d.id, name: data.name || "Team" });
        });

        const list = Array.from(map.values()).sort((a, b) =>
          a.name.localeCompare(b.name)
        );
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
            Logged in as <strong>{userLabel || "—"}</strong>.
          </div>

          <div className="mt-2 text-xs text-neutral-500">
            Ask an admin to add you to <strong>Coaches</strong> or{" "}
            <strong>Admin</strong> List for the team.
          </div>

          {/* Optional: keep UID available but not front-and-center */}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-700">
              Show technical details
            </summary>
            <div className="mt-1 text-xs text-neutral-600">
              UID: <span className="font-mono">{uid}</span>
            </div>
          </details>
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
                  <div className="text-base font-semibold text-neutral-900">
                    {t.name}
                  </div>

                  <div className="mt-1 text-sm text-neutral-600">
                    Tap to view players & events
                  </div>

                  {t.coachNames && t.coachNames.length > 0 && (
                    <div className="mt-1 text-xs text-neutral-500">
                      Coaches:{" "}
                      <span className="font-medium text-neutral-700">
                        {t.coachNames.join(", ")}
                      </span>
                    </div>
                  )}
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