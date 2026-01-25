"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import Link from "next/link";
import { db } from "@/lib/firebase";

type Player = { id: string; name: string };

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
          setError("Missing teamId from URL. Go back to /teams and reopen the team.");
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
    <main style={{ maxWidth: 720, margin: "24px auto", padding: 16 }}>
      <h1>Team</h1>

      <p style={{ opacity: 0.7, marginBottom: 14 }}>
        Team ID: <code>{teamId}</code>
      </p>

      {/* ACTION LINKS */}
      <div style={{ marginBottom: 18 }}>
        <Link href={`/team/${teamId}/new`}>
          ➕ New Training / Match
        </Link>
        <br />
        <Link href={`/team/${teamId}/import-players`}>
          📥 Bulk import players
        </Link>
      </div>

      {loading && <p>Loading players…</p>}

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {!loading && !error && players.length === 0 && (
        <p>No players found for this team.</p>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {players.map((p) => (
          <li
            key={p.id}
            style={{
              borderBottom: "1px solid #eee",
              padding: "8px 0",
            }}
          >
            {p.name}
          </li>
        ))}
      </ul>
    </main>
  );
}

