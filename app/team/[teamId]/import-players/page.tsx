"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "../../../components/AppShell";

type Player = { id: string; name: string };

const MAROON = "#7A0019";
const ROYAL = "#1E3A8A";

function normalizeName(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

export default function ImportPlayersPage() {
  const params = useParams();
  const teamId = typeof params.teamId === "string" ? params.teamId : "";

  const [existing, setExisting] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  // Load existing players for this team (so we can skip duplicates)
  useEffect(() => {
    (async () => {
      try {
        if (!teamId) {
          setMsg("Missing teamId. Go back to Teams and reopen the team.");
          setLoading(false);
          return;
        }
        setLoading(true);
        setMsg("");

        const q = query(collection(db, "players"), where("teamId", "==", teamId));
        const snap = await getDocs(q);
        const list: Player[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setExisting(list);
      } catch (e: any) {
        console.error(e);
        setMsg(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [teamId]);

  const existingSet = useMemo(() => {
    return new Set(existing.map((p) => normalizeName(p.name).toLowerCase()));
  }, [existing]);

  const parsedNames = useMemo(() => {
    // Accept: pasted Excel column, CSV, or newline-separated
    const raw = text
      .split(/\r?\n|,|\t/g)
      .map((s) => normalizeName(s))
      .filter(Boolean);

    // De-dupe within paste
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const n of raw) {
      const key = n.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(n);
      }
    }
    return unique;
  }, [text]);

  const { toAdd, alreadyThere } = useMemo(() => {
    const add: string[] = [];
    const exists: string[] = [];
    for (const n of parsedNames) {
      if (existingSet.has(n.toLowerCase())) exists.push(n);
      else add.push(n);
    }
    return { toAdd: add, alreadyThere: exists };
  }, [parsedNames, existingSet]);

  async function importNow() {
    setMsg("");
    if (!teamId) return setMsg("Missing teamId.");
    if (toAdd.length === 0) return setMsg("Nothing new to import.");

    try {
      setSaving(true);

      // Create new player docs
      for (const name of toAdd) {
        await addDoc(collection(db, "players"), {
          teamId,
          name,
          createdAt: Date.now(),
        });
      }

      setMsg(`Imported ${toAdd.length} player(s).`);

      // refresh list
      const q = query(collection(db, "players"), where("teamId", "==", teamId));
      const snap = await getDocs(q);
      const list: Player[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setExisting(list);

      setText("");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Import Players">
      <div className="mb-4">
        <Link
          href={`/team/${teamId}`}
          className="text-sm font-semibold underline-offset-4 hover:underline"
        >
          ← Back to Team
        </Link>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Bulk import players</h1>
            <div className="mt-1 text-sm text-neutral-600">
              Paste a column from Excel (one name per row). Commas and tabs also work.
            </div>
          </div>
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: ROYAL }}
          >
            Team
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-sm text-neutral-600">Loading existing players…</div>
        ) : (
          <>
            <div className="mt-4">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Paste names
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder={"John Smith\nMary Moran\n…"}
                className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
              />
              <div className="mt-2 text-xs text-neutral-500">
                Preview: <strong>{parsedNames.length}</strong> unique name(s) detected.
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-sm">
                New to add: <strong>{toAdd.length}</strong>{" "}
                {alreadyThere.length > 0 && (
                  <>
                    • Already in team: <strong>{alreadyThere.length}</strong>
                  </>
                )}
              </div>

              {alreadyThere.length > 0 && (
                <div className="mt-2 text-xs text-neutral-600">
                  Already in team (skipped): {alreadyThere.slice(0, 12).join(", ")}
                  {alreadyThere.length > 12 ? "…" : ""}
                </div>
              )}
            </div>

            {msg && (
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-3 text-sm text-neutral-800">
                {msg}
              </div>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link
                href={`/team/${teamId}`}
                className="rounded-xl bg-neutral-100 px-4 py-2.5 text-center text-sm font-semibold text-neutral-900 hover:bg-neutral-200"
              >
                Cancel
              </Link>

              <button
                onClick={importNow}
                disabled={saving || toAdd.length === 0}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: MAROON }}
              >
                {saving ? "Importing…" : `Import ${toAdd.length}`}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="text-sm font-semibold">Current players</div>
        <div className="mt-2 text-sm text-neutral-600">
          Total: <strong>{existing.length}</strong>
        </div>

        {existing.length > 0 && (
          <div className="mt-3 rounded-2xl border border-neutral-200 bg-white divide-y">
            {existing.map((p) => (
              <div key={p.id} className="px-4 py-3 text-sm">
                {p.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
