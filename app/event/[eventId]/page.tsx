"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type Player = { id: string; name: string };

type EventDoc = {
  teamId: string;
  type: "training" | "match" | "challenge";
  date: string;
  venue: string;
  opposition?: string;
  teamGoals?: number;
  teamPoints?: number;
  oppGoals?: number;
  oppPoints?: number;
};

type Status = "present" | "absent" | "late" | "injured";

type AttendanceRow = {
  status: Status;
  reason?: string;
};

const REASONS = ["Rugby", "Soccer", "Hurling", "Holidays", "Work", "No Apology"];

export default function EventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = typeof params.eventId === "string" ? params.eventId : "";

  const [event, setEvent] = useState<(EventDoc & { id: string }) | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [att, setAtt] = useState<Record<string, AttendanceRow>>({});
  const [loading, setLoading] = useState(true);
  const [pageMsg, setPageMsg] = useState("");

  // Save indicator
  const [saveState, setSaveState] =
    useState<"idle" | "saving" | "saved" | "error">("idle");

  // Button busy state
  const [finalising, setFinalising] = useState(false);

  const totalPlayers = players.length;

  const markedCount = useMemo(() => {
    // count players that have any attendance row in state
    // (after loading we usually have all present, but this still works)
    return Object.keys(att).length;
  }, [att]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setPageMsg("");

        if (!eventId) {
          setPageMsg("Missing eventId in URL.");
          return;
        }

        // 1) Load event
        const evSnap = await getDoc(doc(db, "events", eventId));
        if (!evSnap.exists()) {
          setPageMsg("Event not found.");
          return;
        }

        const ev = { id: evSnap.id, ...(evSnap.data() as any) } as EventDoc & {
          id: string;
        };
        setEvent(ev);

        // 2) Load players for team
        const psnap = await getDocs(
          query(collection(db, "players"), where("teamId", "==", ev.teamId))
        );

        const plist: Player[] = [];
        psnap.forEach((d) => plist.push({ id: d.id, ...(d.data() as any) }));
        plist.sort((a, b) => a.name.localeCompare(b.name));
        setPlayers(plist);

        // 3) Load existing attendance records for this event
        const asnap = await getDocs(
          query(collection(db, "attendance"), where("eventId", "==", eventId))
        );

        const map: Record<string, AttendanceRow> = {};
        asnap.forEach((d) => {
          const data = d.data() as any;
          const pid = data.playerId as string;
          const status = (data.status ?? "present") as Status;
          const reason = typeof data.reason === "string" ? data.reason : undefined;
          map[pid] = { status, reason };
        });

        // Default missing players to present (so UI is always filled)
        for (const p of plist) {
          if (!map[p.id]) map[p.id] = { status: "present" };
        }

        setAtt(map);
      } catch (e: any) {
        console.error(e);
        setPageMsg(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  async function writeAttendance(playerId: string, row: AttendanceRow) {
    if (!event) return;

    // Update UI instantly
    setAtt((prev) => ({ ...prev, [playerId]: row }));

    try {
      setSaveState("saving");
      await setDoc(doc(db, "attendance", `${eventId}_${playerId}`), {
        eventId,
        playerId,
        teamId: event.teamId, // IMPORTANT for security rules
        status: row.status,
        reason: row.status === "absent" ? row.reason ?? null : null,
        updatedAt: Date.now(),
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1200);
    } catch (e) {
      console.error(e);
      setSaveState("error");
    }
  }

  async function setStatus(playerId: string, status: Status) {
    const current = att[playerId] ?? { status: "present" as Status };

    const nextRow: AttendanceRow =
      status === "absent"
        ? { status: "absent", reason: current.reason }
        : { status };

    await writeAttendance(playerId, nextRow);
  }

  async function setReason(playerId: string, reason: string) {
    await writeAttendance(playerId, { status: "absent", reason: reason || undefined });
  }

  // ✅ NEW: Finalise/Sync - writes a record for EVERY player (present by default)
  async function finaliseAttendance() {
    if (!event) return;
    if (players.length === 0) return;

    setFinalising(true);
    setSaveState("saving");

    try {
      for (const p of players) {
        const row = att[p.id] ?? { status: "present" as Status };

        await setDoc(doc(db, "attendance", `${eventId}_${p.id}`), {
          eventId,
          playerId: p.id,
          teamId: event.teamId,
          status: row.status,
          reason: row.status === "absent" ? row.reason ?? null : null,
          updatedAt: Date.now(),
        });
      }

      // ensure UI has a row for everyone
      setAtt((prev) => {
        const next = { ...prev };
        for (const p of players) {
          if (!next[p.id]) next[p.id] = { status: "present" };
        }
        return next;
      });

      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (e) {
      console.error(e);
      setSaveState("error");
    } finally {
      setFinalising(false);
    }
  }

  if (loading) return <main style={{ padding: 16 }}>Loading…</main>;
  if (!event) return <main style={{ padding: 16 }}>{pageMsg || "Event missing."}</main>;

  const isMatch = event.type === "match" || event.type === "challenge";

  return (
    <main style={{ maxWidth: 860, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => router.back()} style={{ padding: "8px 10px" }}>
          ← Back
        </button>

        <button
          onClick={finaliseAttendance}
          disabled={finalising}
          style={{ padding: "8px 12px", fontWeight: 600 }}
        >
          {finalising ? "Saving all…" : "Save / Finalise Attendance"}
        </button>
      </div>

      <h1 style={{ margin: "14px 0 6px" }}>
        {event.type.toUpperCase()} — {event.date}
      </h1>

      <p style={{ marginTop: 0, opacity: 0.85 }}>
        <strong>Venue:</strong> {event.venue}
        {isMatch && event.opposition ? (
          <>
            {" "}
            • <strong>Vs:</strong> {event.opposition}
          </>
        ) : null}
      </p>

      {isMatch && (
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          <strong>Score:</strong>{" "}
          {event.teamGoals ?? 0}-{event.teamPoints ?? 0} to {event.oppGoals ?? 0}-{event.oppPoints ?? 0}
        </p>
      )}

      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Players loaded: <strong>{totalPlayers}</strong> • Attendance rows in state:{" "}
        <strong>{markedCount}</strong>
      </p>

      {saveState !== "idle" && (
        <p style={{ marginTop: 8, opacity: 0.9 }}>
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved ✓"}
          {saveState === "error" && "Save failed (check rules/permissions)."}
        </p>
      )}

      <h2 style={{ marginTop: 18 }}>Attendance</h2>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {players.map((p) => {
          const row = att[p.id] ?? { status: "present" as Status };

          return (
            <li
              key={p.id}
              style={{
                border: "1px solid #eee",
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <strong>{p.name}</strong>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    onClick={() => setStatus(p.id, "present")}
                    style={{
                      padding: "8px 10px",
                      border: row.status === "present" ? "2px solid #333" : "1px solid #ccc",
                    }}
                  >
                    Present
                  </button>

                  <button
                    onClick={() => setStatus(p.id, "absent")}
                    style={{
                      padding: "8px 10px",
                      border: row.status === "absent" ? "2px solid #333" : "1px solid #ccc",
                    }}
                  >
                    Absent
                  </button>

                  <button
                    onClick={() => setStatus(p.id, "late")}
                    style={{
                      padding: "8px 10px",
                      border: row.status === "late" ? "2px solid #333" : "1px solid #ccc",
                    }}
                  >
                    Late
                  </button>

                  <button
                    onClick={() => setStatus(p.id, "injured")}
                    style={{
                      padding: "8px 10px",
                      border: row.status === "injured" ? "2px solid #333" : "1px solid #ccc",
                    }}
                  >
                    Injured
                  </button>
                </div>
              </div>

              {row.status === "absent" && (
                <div style={{ marginTop: 10 }}>
                  <label style={{ fontSize: 13, opacity: 0.8 }}>Reason (optional)</label>
                  <select
                    value={row.reason ?? ""}
                    onChange={(e) => setReason(p.id, e.target.value)}
                    style={{ width: "100%", padding: 10, marginTop: 6 }}
                  >
                    <option value="">—</option>
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}

