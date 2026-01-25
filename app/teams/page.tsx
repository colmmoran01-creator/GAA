"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type Team = { id: string; name: string; season?: string };

export default function TeamsPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [uid, setUid] = useState("");

  useEffect(() => {
    // Subscribe to auth changes
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "/login";
        return;
      }

      setUid(user.uid);

      // Load teams for this UID (admin OR coach)
      (async () => {
        try {
          setLoading(true);
          setMsg("");

          const qAdmin = query(
            collection(db, "teams"),
            where("adminUids", "array-contains", user.uid)
          );
          const qCoach = query(
            collection(db, "teams"),
            where("coachUids", "array-contains", user.uid)
          );

          const [adminSnap, coachSnap] = await Promise.all([
            getDocs(qAdmin),
            getDocs(qCoach),
          ]);

          const map = new Map<string, Team>();

          adminSnap.forEach((d) => {
            const data = d.data() as any;
            map.set(d.id, { id: d.id, name: data.name, season: data.season });
          });

          coachSnap.forEach((d) => {
            const data = d.data() as any;
            map.set(d.id, { id: d.id, name: data.name, season: data.season });
          });

          const list = Array.from(map.values()).sort((a, b) =>
            (a.name || "").localeCompare(b.name || "")
          );

          setTeams(list);
        } catch (e: any) {
          console.error(e);
          setMsg(e?.message ?? String(e));
        } finally {
          setLoading(false);
        }
      })();
    });

    // ✅ Cleanup must be returned from useEffect (and ONLY here)
    return () => {
      unsub();
    };
  }, []);

  async function logout() {
    await signOut(auth);
    window.location.href = "/";
  }

  if (loading) return <main style={{ padding: 16 }}>Loading teams…</main>;

  return (
    <main style={{ maxWidth: 760, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Your Teams</h1>
        <button onClick={logout} style={{ padding: "8px 10px" }}>
          Logout
        </button>
      </div>

      {/* UID helper */}
      <div
        style={{
          marginTop: 12,
          padding: 10,
          border: "1px dashed #ccc",
          borderRadius: 8,
          fontSize: 13,
          background: "#fafafa",
        }}
      >
        <strong>Your User ID (UID)</strong>
        <div style={{ wordBreak: "break-all", marginTop: 4 }}>{uid}</div>
        <div style={{ marginTop: 6, opacity: 0.7 }}>
          Add this UID to <code>adminUids</code> or <code>coachUids</code> in the team document.
        </div>
      </div>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      {teams.length === 0 ? (
        <p style={{ marginTop: 16 }}>
          No teams found for your user yet. Once your UID is added to a team, it will appear here automatically.
        </p>
      ) : (
        <ul style={{ marginTop: 16, paddingLeft: 18 }}>
          {teams.map((t) => (
            <li key={t.id} style={{ marginBottom: 10 }}>
              <Link href={`/team/${t.id}`} style={{ fontWeight: 700 }}>
                {t.name}
              </Link>
              {t.season ? <span style={{ opacity: 0.7 }}> — Season {t.season}</span> : null}
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 18 }}>
        <Link href="/admin">Admin Reports</Link>
      </div>
    </main>
  );
}

