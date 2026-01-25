"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";

type Team = { id: string; name: string; season: string };

export default function TeamsPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [msg, setMsg] = useState("Loading…");

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMsg("You are not logged in. Go to /login");
        return;
      }
      setUid(user.uid);

      // Find teams where you're a coach or admin
      const teamsRef = collection(db, "teams");
      const q1 = query(teamsRef, where("coachUids", "array-contains", user.uid));
      const q2 = query(teamsRef, where("adminUids", "array-contains", user.uid));

      const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const map = new Map<string, Team>();

      s1.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() as any) }));
      s2.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() as any) }));

      const list = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
      setTeams(list);
      setMsg(list.length ? "" : "No teams found for your user yet (check coachUids/adminUids).");
    });
  }, []);

  return (
    <main style={{ maxWidth: 640, margin: "24px auto", padding: 16 }}>
      <h1>My Teams</h1>
      {!uid && <p>{msg}</p>}

      {teams.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {teams.map((t) => (
            <li key={t.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14, marginBottom: 10 }}>
              <strong>{t.name}</strong> <span style={{ opacity: 0.7 }}>(Season {t.season})</span>
              <div style={{ marginTop: 8 }}>
                <Link href={`/team/${t.id}`}>Open team</Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginTop: 16, opacity: 0.7 }}>
        Tip: If you see “No teams found”, make sure you pasted your UID into coachUids/adminUids.
      </p>
    </main>
  );
}
