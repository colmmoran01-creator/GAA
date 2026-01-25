"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import Link from "next/link";
import { db } from "@/lib/firebase";
import AppShell from "../components/AppShell";

type Player = { id: string; name: string };

const MAROON = "#7A0019";
const ROYAL = "#1E3A8A";

export default function TeamPage() {
  const params = useParams();
  const teamId = typeof params.teamId === "string" ? params.teamId : "";

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (!teamId) {
          setError("Missing teamId from URL. Go back to Teams and reopen the team.");
          setLoading(false);
          return;
        }

        const q = query(
          collection(db, "players"),
          where("teamId", "==", teamId)
        );

        const snap = await getDocs(q);
        const list: Player[] = [];

        snap.forEach((d) =>
          list.push({ id: d.id, ...(d.data() as any) })
        );

        list.sort((a, b) => a.name.localeCompare(b.name));
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
    <AppShell title="Team">
      {/* TEAM HEADER */}
      <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Team</h1>
            <div className="mt-1 text-xs text-neutral-500">
              Team ID: <code className="font-mono">{teamId}</code>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/team/${teamId}/new`}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: ROYAL }}
            >
              ➕ New Event
            </Link>

            <Link
              href={`/team/${teamId}/import-players`}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: MAROON }}
            >
              📥 Import
            </Link>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      {loading && (
        <div className="py-10 text-sm text-neutral-600">
          Loading players…
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && players.length === 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
          No players found for this team.
        </div>
      )}

      {!loading && players.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white divide-y">
          {players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="text-sm font-medium">{p.name}</div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
