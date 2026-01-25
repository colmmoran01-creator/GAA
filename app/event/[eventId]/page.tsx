"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "../../components/AppShell";

type EventDoc = {
  teamId: string;
  type: "training" | "match" | "challenge";
  date: string; // yyyy-mm-dd
  venue?: string;

  venueType?: string;
  venueOther?: string;

  opposition?: string;
  teamGoals?: number;
  teamPoints?: number;
  oppGoals?: number;
  oppPoints?: number;
  result?: "W" | "D" | "L";
};

type Player = { id: string; name: string };

type AttendanceStatus = "present" | "absent";
type AttendanceReason =
  | ""
  | "Rugby"
  | "Soccer"
  | "Hurling"
  | "Holidays"
  | "Work"
  | "No Apology";

type AttendanceDoc = {
  id: string;
  eventId: string;
  teamId: string;
  playerId: string;
  status: AttendanceStatus;
  reason: AttendanceReason;
  updatedAt: number;
};

const MAROON = "#7A0019";
const ROYAL = "#1E3A8A";

function scoreString(e: EventDoc) {
  const tg = e.teamGoals ?? 0;
  const tp = e.teamPoints ?? 0;
  const og = e.oppGoals ?? 0;
  const op = e.oppPoints ?? 0;
  return `${tg}-${tp} vs ${og}-${op}`;
}

export default function EventPage() {
  const params = useParams();
  const eventId = typeof params.eventId === "string" ? params.eventId : "";

  const [event, setEvent] = useState<EventDoc | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [attendanceDocs, setAttendanceDocs] = useState<AttendanceDoc[]>([]);

  // Local editable state (so we can save explicitly)
  const [draft, setDraft] = useState<Record<string, { status: AttendanceStatus; reason: AttendanceReason }>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const attendanceByPlayer = useMemo(() => {
    const m = new Map<string, AttendanceDoc>();
    for (const a of attendanceDocs) m.set(a.playerId, a);
    return m;
  }, [attendanceDocs]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");
        setMsg("");

        if (!eventId) {
          setError("Missing eventId from URL.");
          setLoading(false);
          return;
        }

        // 1) Load event
        const evSnap = await getDoc(doc(db, "events", eventId));
        if (!evSnap.exists()) {
          setError("Event not found.");
          setLoading(false);
          return;
        }

        const ev = evSnap.data() as any as EventDoc;
        if (!ev?.teamId) {
          setError("Event is missing teamId.");
          setLoading(false);
          return;
        }

        setEvent(ev);

        // 2) Load players for that team
        const pq = query(collection(db, "players"), where("teamId", "==", ev.teamId));
        const psnap = await getDocs(pq);
        const plist: Player[] = [];
        psnap.forEach((d) => plist.push({ id: d.id, ...(d.data() as any) }));
        plist.sort((a, b) => a.name.localeCompare(b.name));
        setPlayers(plist);

        // 3) Load existing attendance for this event
        const aq = query(collection(db, "attendance"), where("eventId", "==", eventId));
        const asnap = await getDocs(aq);
        const alist: AttendanceDoc[] = [];
        asnap.forEach((d) => alist.push({ id: d.id, ...(d.data() as any) }));
        setAttendanceDocs(alist);

        // 4) Build draft from existing docs, defaulting to "present"
        const nextDraft: Record<string, { status: AttendanceStatus; reason: AttendanceReason }> = {};
        const amap = new Map<string, AttendanceDoc>();
        for (const a of alist) amap.set(a.playerId, a);

        for (const p of plist) {
          const existing = amap.get(p.id);
          if (existing) {
            nextDraft[p.id] = { status: existing.status, reason: existing.reason ?? "" };
          } else {
            nextDraft[p.id] = { status: "present", reason: "" };
          }
        }
        setDraft(nextDraft);
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  function setStatus(playerId: string, status: AttendanceStatus) {
    setDraft((prev) => {
      const cur = prev[playerId] ?? { status: "present" as AttendanceStatus, reason: "" as AttendanceReason };
      return {
        ...prev,
        [playerId]: {
          status,
          reason: status === "present" ? "" : cur.reason,
        },
      };
    });
  }

  function setReason(playerId: string, reason: AttendanceReason) {
    setDraft((prev) => {
      const cur = prev[playerId] ?? { status: "absent" as AttendanceStatus, reason: "" as AttendanceReason };
      return {
        ...prev,
        [playerId]: { ...cur, reason },
      };
    });
  }

  const summary = useMemo(() => {
    const total = players.length;
    let present = 0;
    let absent = 0;
    for (const p of players) {
      const d = draft[p.id];
      if (!d) continue;
      if (d.status === "present") present++;
      else absent++;
    }
    return { total, present, absent };
  }, [players, draft]);

  async function saveAll() {
    try {
      setSaving(true);
      setError("");
      setMsg("");

      if (!eventId) throw new Error("Missing eventId.");
      if (!event?.teamId) throw new Error("Missing teamId on event.");

      // For each player:
      // - if attendance doc exists -> update it
      // - else -> create it
      const now = Date.now();

      for (const p of players) {
        const d = draft[p.id];
        if (!d) continue;

        const existing = attendanceByPlayer.get(p.id);

        if (existing) {
          await updateDoc(doc(db, "attendance", existing.id), {
            status: d.status,
            reason: d.status === "absent" ? d.reason : "",
            updatedAt: now,
          });
        } else {
          await addDoc(collection(db, "attendance"), {
            eventId,
            teamId: event.teamId,
            playerId: p.id,
            status: d.status,
            reason: d.status === "absent" ? d.reason : "",
            updatedAt: now,
          });
        }
      }

      // Reload attendance docs after save so admin reports match
      const aq = query(collection(db, "attendance"), where("eventId", "==", eventId));
      const asnap = await getDocs(aq);
      const alist: AttendanceDoc[] = [];
      asnap.forEach((d) => alist.push({ id: d.id, ...(d.data() as any) }));
      setAttendanceDocs(alist);

      setMsg("Saved ✅");
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell title="Attendance" showTopNav={false}>
        <div className="py-10 text-sm text-neutral-600">Loading…</div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Attendance" showTopNav={false}>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      </AppShell>
    );
  }

  if (!event) {
    return (
      <AppShell title="Attendance" showTopNav={false}>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-800">
          No event data found.
        </div>
      </AppShell>
    );
  }

  const showScore = event.type === "match" || event.type === "challenge";

  return (
    <AppShell title="Attendance" showTopNav={false}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={`/team/${event.teamId}`}
          className="text-sm font-semibold underline-offset-4 hover:underline"
        >
          ← Back to Team
        </Link>

        <button
          onClick={saveAll}
          disabled={saving}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: MAROON }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold capitalize">
              {event.type} • {event.date}
            </div>
            <div className="mt-1 text-sm text-neutral-600">
              Venue: <strong>{event.venue || "—"}</strong>
              {showScore && event.opposition ? (
                <>
                  {" "}
                  • Opposition: <strong>{event.opposition}</strong>
                </>
              ) : null}
            </div>

            {showScore && (
              <div className="mt-2 text-sm">
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: ROYAL }}
                >
                  {event.result ? `Result: ${event.result}` : "Match"}
                </span>
                <span className="ml-2 text-sm text-neutral-700">
                  {scoreString(event)}
                </span>
              </div>
            )}
          </div>

          <div className="text-sm text-neutral-700">
            <div>
              Total: <strong>{summary.total}</strong>
            </div>
            <div>
              Present: <strong>{summary.present}</strong> • Absent:{" "}
              <strong>{summary.absent}</strong>
            </div>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-800">
            {msg}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white divide-y">
        {players.map((p) => {
          const d = draft[p.id] ?? { status: "present" as AttendanceStatus, reason: "" as AttendanceReason };
          const isPresent = d.status === "present";
          const isAbsent = d.status === "absent";

          return (
            <div key={p.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">{p.name}</div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setStatus(p.id, "present")}
                    className={[
                      "rounded-xl px-3 py-2 text-xs font-semibold transition",
                      isPresent ? "text-white" : "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
                    ].join(" ")}
                    style={isPresent ? { backgroundColor: ROYAL } : undefined}
                  >
                    Present
                  </button>

                  <button
                    onClick={() => setStatus(p.id, "absent")}
                    className={[
                      "rounded-xl px-3 py-2 text-xs font-semibold transition",
                      isAbsent ? "text-white" : "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
                    ].join(" ")}
                    style={isAbsent ? { backgroundColor: MAROON } : undefined}
                  >
                    Absent
                  </button>
                </div>
              </div>

              {isAbsent && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    Reason
                  </label>
                  <select
                    value={d.reason}
                    onChange={(e) => setReason(p.id, e.target.value as AttendanceReason)}
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
                  >
                    <option value="">Select…</option>
                    <option value="Rugby">Rugby</option>
                    <option value="Soccer">Soccer</option>
                    <option value="Hurling">Hurling</option>
                    <option value="Holidays">Holidays</option>
                    <option value="Work">Work</option>
                    <option value="No Apology">No Apology</option>
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <button
          onClick={saveAll}
          disabled={saving}
          className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: MAROON }}
        >
          {saving ? "Saving…" : "Save Attendance"}
        </button>
      </div>
    </AppShell>
  );
}
