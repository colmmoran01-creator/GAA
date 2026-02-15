"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "../../../components/AppShell";

type Player = { id: string; name: string };

function normalizeName(s: string) {
  return s
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
}

export default function PlayerManagementPage() {
  const params = useParams();
  const teamId = typeof params.teamId === "string" ? params.teamId : "";

  const [teamName, setTeamName] = useState<string>("Team");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const [players, setPlayers] = useState<Player[]>([]);
  const [paste, setPaste] = useState<string>("");

  const [removingId, setRemovingId] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        setMsg("");

        if (!teamId) {
          setErr("Missing teamId in URL. Go back to Teams and reopen the team.");
          return;
        }

        const teamSnap = await getDoc(doc(db, "teams", teamId));
        if (teamSnap.exists()) {
          const data = teamSnap.data() as any;
          setTeamName(data?.name ?? teamId);
        } else {
          setTeamName(teamId);
        }

        const qPlayers = query(collection(db, "players"), where("teamId", "==", teamId));
        const snap = await getDocs(qPlayers);

        const list: Player[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
        setPlayers(list);
      } catch (e: any) {
        console.error(e);
        setErr(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [teamId]);

  const existingLower = useMemo(() => {
    const set = new Set<string>();
    players.forEach((p) => set.add((p.name ?? "").toLowerCase()));
    return set;
  }, [players]);

  const parsed = useMemo(() => {
    // Accept: pasted Excel column, CSV, or newline list
    const raw = paste
      .split(/\r?\n|,|;/g)
      .map((x) => normalizeName(x))
      .filter(Boolean);

    // de-dup in the pasted input (case-insensitive)
    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of raw) {
      const key = n.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(n);
      }
    }
    return out;
  }, [paste]);

  const toAdd = useMemo(() => {
    // Only names not already in Firestore list
    return parsed.filter((n) => !existingLower.has(n.toLowerCase()));
  }, [parsed, existingLower]);

  async function addPlayers() {
    try {
      setErr("");
      setMsg("");

      if (!teamId) return;
      if (toAdd.length === 0) {
        setMsg("Nothing new to add (all names already exist).");
        return;
      }

      // Add as individual player docs for this team
      for (const name of toAdd) {
        await addDoc(collection(db, "players"), {
          teamId,
          name,
          createdAt: Date.now(),
        });
      }

      // Reload list
      const qPlayers = query(collection(db, "players"), where("teamId", "==", teamId));
      const snap = await getDocs(qPlayers);
      const list: Player[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
      setPlayers(list);

      setPaste("");
      setMsg(`Added ${toAdd.length} player(s).`);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? String(e));
    }
  }

  async function removePlayer(playerId: string, playerName: string) {
    try {
      setErr("");
      setMsg("");
      setRemovingId(playerId);

      const ok = confirm(`Remove player:\n\n${playerName}\n\nThis does NOT delete past attendance records, but they may show as "Unknown player" in old reports unless we handle that later.`);
      if (!ok) return;

      await deleteDoc(doc(db, "players", playerId));
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
      setMsg(`Removed ${playerName}.`);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? String(e));
    } finally {
      setRemovingId("");
    }
  }

  return (
    <AppShell title="Player Management">
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Player Management</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Team: <span className="font-medium text-neutral-900">{teamName}</span>
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Team ID: <span className="font-mono">{teamId}</span>
            </p>
          </div>

          <Link
            href={`/team/${teamId}`}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50"
          >
            ← Team
          </Link>
        </div>

        {msg && <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</div>}
        {err && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}

        <div className="mt-4 grid gap-3">
          <div>
            <label className="block text-sm font-medium text-neutral-800">Paste players</label>
            <p className="mt-1 text-xs text-neutral-500">
              Paste from Excel (one column), or comma/newline-separated. We’ll de-duplicate and ignore existing names.
            </p>

            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={6}
              className="mt-2 w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900/10"
              placeholder={`Example:\nAoife Smith\nConor Kelly\n...`}
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={addPlayers}
                className="rounded-full bg-[#1E3A8A] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                disabled={!teamId || loading || toAdd.length === 0}
              >
                ➕ Add {toAdd.length > 0 ? `(${toAdd.length})` : ""}
              </button>

              <div className="text-xs text-neutral-500">
                Current players: <span className="font-medium text-neutral-800">{players.length}</span>
                {" • "}
                New from paste: <span className="font-medium text-neutral-800">{toAdd.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">Current players</h2>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-neutral-600">Loading…</div>
        ) : players.length === 0 ? (
          <div className="p-4 text-sm text-neutral-600">No players yet.</div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {players.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm font-medium text-neutral-900">{p.name}</span>

                <button
                  onClick={() => removePlayer(p.id, p.name)}
                  className="rounded-full bg-[#7A0019] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                  disabled={removingId === p.id}
                >
                  {removingId === p.id ? "Removing…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
