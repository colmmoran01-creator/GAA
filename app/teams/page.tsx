"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type Team = { id: string; name: string; season: string };

export default function TeamsPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/login";
        return;
      }

      try {
        setLoading(true);
        setMsg("");

        // Show teams where user is coach or admin (UID based)
        const snap = await getDocs(
          query(
            collection(db, "teams"),
            where("memberUids", "array-contains", user.uid)
          )
        );

        const list: Team[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        list.sort((a, b) => a.name.localeCompare(b.name));
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

  if (loading) return <main style={{ padding: 16 }}>Loading teams…</main>;

  return (
    <main style={{ maxWidth: 720, margin: "24px auto", padding: 16 }}>
      <h1>Your Teams</h1>
      {msg && <p>{msg}</p>}

      {teams.length === 0 ? (
        <p>No teams found for your user. Ask admin to add your UID (or we’ll switch to email invites).</p>
      ) : (
        <ul>
          {teams.map((t) => (
            <li key={t.id} style={{ marginBottom: 10 }}>
              <Link href={`/team/${t.id}`}>{t.name} (Season {t.season})</Link>
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginTop: 20 }}>
        <Link href="/admin">Admin Reports</Link>
      </p>
    </main>
  );
}

