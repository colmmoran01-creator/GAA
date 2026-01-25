"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

function normalizeName(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

export default function ImportPlayersPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = typeof params.teamId === "string" ? params.teamId : "";

  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [skipExisting, setSkipExisting] = useState(true);

  const names = useMemo(() => {
    const lines = text.split(/\r?\n/).map(normalizeName).filter(Boolean);
    // de-dupe in the pasted list
    const seen = new Set<string>();
    return lines.filter((n) => {
      const key = n.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [text]);

  async function importPlayers() {
    if (!teamId) return alert("Missing teamId. Go back to /teams and open a team.");
    if (names.length === 0) return alert("Paste at least 1 name (one per line).");

    setBusy(true);
    setMsg("");

    try {
      // Optional: read existing player names for this team to avoid duplicates
      let existing = new Set<string>();
      if (skipExisting) {
        const snap = await getDocs(query(collection(db, "players"), where("teamId", "==", teamId)));
        snap.forEach((d) => {
          const nm = (d.data() as any).name;
          if (typeof nm === "string") existing.add(nm.trim().toLowerCase());
        });
      }

      let added = 0;
      let skipped = 0;

      // Add one document per player
      for (const name of names) {
        const key = name.toLowerCase();
        if (skipExisting && existing.has(key)) {
          skipped++;
          continue;
        }

        await addDoc(collection(db, "players"), {
          teamId,
          name,
          createdAt: Date.now(),
        });

        added++;
        existing.add(key);
      }

      setMsg(`✅ Import complete: added ${added}, skipped ${skipped}.`);
      // Send you back to the team page where you can see them
      router.push(`/team/${teamId}`);
    } catch (e: any) {
      console.error(e);
      setMsg(`❌ ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "24px auto", padding: 16 }}>
      <h1>Bulk Player Import</h1>

      <p style={{ opacity: 0.8 }}>
        Paste player names below, <strong>one per line</strong>.
      </p>

      <label style={{ display: "block", marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={skipExisting}
          onChange={(e) => setSkipExisting(e.target.checked)}
        />{" "}
        Skip names that already exist for this team
      </label>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        style={{ width: "100%", padding: 12, fontFamily: "inherit" }}
        placeholder={`e.g.
Liam Moran
Conor Walsh
Eoin Kelly`}
      />

      <p style={{ marginTop: 10, opacity: 0.8 }}>
        Names detected: <strong>{names.length}</strong>
      </p>

      <button
        disabled={busy}
        onClick={importPlayers}
        style={{ width: "100%", padding: 12, marginTop: 10 }}
      >
        {busy ? "Importing…" : "Import Players"}
      </button>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </main>
  );
}
