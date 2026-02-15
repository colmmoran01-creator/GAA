"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "../../components/AppShell";

type Player = { id: string; name: string };

export default function TeamPage() {
  const params = useParams();
  const teamId = typeof params.teamId === "string" ? params.teamId : "";

  const [teamName, setTeamName] = useState<string>("Team");
  const [coachNames, setCoachNames] = useState<string[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");

        if (!teamId) {
          setError("Missing teamId from URL. Go back to /teams and reopen the team.");
          return;
        }

        // Team info
        const teamSnap = await getDoc(doc(db, "teams", teamId));
        if (teamSnap.exists()) {
          const data = teamSnap.data() as any;
          setTeamName(data?.name ?? teamId);
          setCoachNames(Array.isArray(data?.coachNames) ? data.coachNames : []);
        } else {
          setTeamName(teamId);
          setCoachNames([]);
        }

        // Players
        const q = query(collection(db, "players"), where("teamId", "==", teamId));
        const snap = await getDocs(q);

        const list: Player[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
        setPlayers(list);
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [teamId]);

  return (
    <AppShell title={teamName}>
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">{teamName}</h1>

            {coachNames.length > 0 && (
              <p className="mt-1 text-sm text-neutral-600">
                Coaches: <span className="font-medium text-neutral-800">{coachNames.join(", ")}</span>
              </p>
            )}

            <p className="mt-1 text-xs text-neutral-500">
              Team ID: <span className="font-mono">{teamId}</span>
            </p>
          </div>

          <Link
            href="/teams"
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50"
          >
            ← Teams
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/team/${teamId}/new`}
            className="rounded-full bg-[#1E3A8A] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            ➕ New Event
          </Link>

          <Link
            href={`/team/${teamId}/import-players`}
            className="rounded-full bg-[#7A0019] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            👥 Player Management
          </Link>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {loading && <div className="p-4 text-sm text-neutral-600">Loading players…</div>}
        {!loading && error && <div className="p-4 text-sm text-red-700">{error}</div>}

        {!loading && !error && (
          <ul className="divide-y divide-neutral-100">
            {players.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-neutral-900">{p.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
