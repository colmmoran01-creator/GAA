"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import * as XLSX from "xlsx";
import AppShell from "@/components/AppShell";


type Team = { id: string; name: string; season?: string };

type Player = { id: string; name: string; teamId: string };

type EventDoc = {
  id: string;
  teamId: string;
  type: string; // training/match/challenge
  date: string; // YYYY-MM-DD
  venue?: string; // final string (Maryland/Tang/Other text)
  venueType?: string;
  venueOther?: string;
};

type AttendanceDoc = {
  id: string;
  eventId: string;
  playerId: string;
  status?: string; // Present/Absent
  reason?: string; // Soccer/Holidays/etc.
};

function prettyType(t: string) {
  const s = (t || "").toLowerCase();
  if (s === "training") return "Training";
  if (s === "match") return "Match";
  if (s === "challenge") return "Challenge";
  return t || "Event";
}

function prettyDate(iso: string) {
  // keep as ISO for sorting, but nicer display in sheet
  // You can change this later if you want DD/MM
  return iso || "";
}

function venueLabel(e: EventDoc) {
  // prefer the simple single string, fallback to type/other
  if (e.venue && e.venue.trim()) return e.venue.trim();
  if ((e.venueType || "").toLowerCase() === "other") return (e.venueOther || "Other").trim() || "Other";
  return (e.venueType || "Other").trim() || "Other";
}

function safeCell(v: any) {
  if (v === null || v === undefined) return "";
  return typeof v === "string" || typeof v === "number" ? v : String(v);
}

export default function AdminPage() {
  const [uid, setUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState("");

  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [attendance, setAttendance] = useState<AttendanceDoc[]>([]);

  // --- auth + load admin teams ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        window.location.href = "/login";
        return;
      }
      setUid(u.uid);

      try {
        setLoading(true);
        setMsg("");

        // Admin teams only
        const qTeams = query(
          collection(db, "teams"),
          where("adminUids", "array-contains", u.uid)
        );
        const snap = await getDocs(qTeams);

        const list: Team[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({ id: d.id, name: data.name, season: data.season });
        });
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setTeams(list);

        // Auto-select first team if none selected
        if (!teamId && list.length) setTeamId(list[0].id);
      } catch (e: any) {
        console.error(e);
        setMsg(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- load team data (players + events + attendance) ---
  useEffect(() => {
    if (!teamId) return;

    (async () => {
      try {
        setLoading(true);
        setMsg("");

        // Players
        const qPlayers = query(
          collection(db, "players"),
          where("teamId", "==", teamId)
        );
        const pSnap = await getDocs(qPlayers);
        const pList: Player[] = [];
        pSnap.forEach((d) => {
          const data = d.data() as any;
          pList.push({ id: d.id, name: data.name, teamId: data.teamId });
        });
        pList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setPlayers(pList);

        // Events (by date)
        const qEvents = query(
          collection(db, "events"),
          where("teamId", "==", teamId),
          orderBy("date", "asc")
        );
        const eSnap = await getDocs(qEvents);
        const eList: EventDoc[] = [];
        eSnap.forEach((d) => {
          const data = d.data() as any;
          eList.push({
            id: d.id,
            teamId: data.teamId,
            type: data.type,
            date: data.date,
            venue: data.venue,
            venueType: data.venueType,
            venueOther: data.venueOther,
          });
        });
        setEvents(eList);

        // Attendance:
        // We support BOTH patterns:
        //  A) top-level collection: attendance {eventId, playerId, status, reason}
        //  B) subcollection: events/{eventId}/attendance
        // We'll first try top-level in one go, then fallback to subcollections if empty.
        let aList: AttendanceDoc[] = [];

        // A) top-level
        try {
          const qAtt = query(
            collection(db, "attendance"),
            where("teamId", "==", teamId)
          );
          const aSnap = await getDocs(qAtt);
          aSnap.forEach((d) => {
            const data = d.data() as any;
            aList.push({
              id: d.id,
              eventId: data.eventId,
              playerId: data.playerId,
              status: data.status,
              reason: data.reason,
            });
          });
        } catch {
          // ignore if you don't have a top-level attendance collection
        }

        // B) subcollections fallback (only if A found nothing)
        if (aList.length === 0 && eList.length > 0) {
          for (const ev of eList) {
            try {
              const sub = collection(db, "events", ev.id, "attendance");
              const subSnap = await getDocs(sub);
              subSnap.forEach((d) => {
                const data = d.data() as any;
                aList.push({
                  id: d.id,
                  eventId: ev.id,
                  playerId: data.playerId,
                  status: data.status,
                  reason: data.reason,
                });
              });
            } catch {
              // ignore missing subcollections
            }
          }
        }

        setAttendance(aList);
      } catch (e: any) {
        console.error(e);
        setMsg(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [teamId]);

  const teamName = useMemo(() => {
    const t = teams.find((x) => x.id === teamId);
    return t?.name || "Team";
  }, [teams, teamId]);

  // Quick index for attendance lookups: eventId|playerId -> record
  const attIndex = useMemo(() => {
    const m = new Map<string, AttendanceDoc>();
    for (const a of attendance) {
      if (!a.eventId || !a.playerId) continue;
      m.set(`${a.eventId}__${a.playerId}`, a);
    }
    return m;
  }, [attendance]);

  function isPresent(a?: AttendanceDoc) {
    const s = (a?.status || "").toLowerCase();
    // handle variants you might have used
    return s === "present" || s === "yes" || s === "y";
  }

  function isAbsent(a?: AttendanceDoc) {
    const s = (a?.status || "").toLowerCase();
    return s === "absent" || s === "no" || s === "n";
  }

  function exportExcel() {
    if (!teamId) return alert("Select a team first.");
    if (events.length === 0) return alert("No events found for this team yet.");
    if (players.length === 0) return alert("No players found for this team.");

    // ----- SHEET 1: MATRIX -----
    const headerType = ["Player", ...events.map((e) => prettyType(e.type)), "Total"];
    const headerDate = ["", ...events.map((e) => prettyDate(e.date)), ""];
    const headerVenue = ["", ...events.map((e) => venueLabel(e)), ""];

    const matrixRows: (string | number)[][] = [];
    matrixRows.push(headerType);
    matrixRows.push(headerDate);
    matrixRows.push(headerVenue);

    // per-event totals (how many YES)
    const perEventYes: number[] = events.map(() => 0);

    // player rows
    for (const p of players) {
      let yesCount = 0;
      const row: (string | number)[] = [p.name];

      events.forEach((ev, idx) => {
        const a = attIndex.get(`${ev.id}__${p.id}`);
        const yes = isPresent(a);
        const cell = yes ? "Yes" : "No";
        row.push(cell);
        if (yes) {
          yesCount += 1;
          perEventYes[idx] += 1;
        }
      });

      row.push(yesCount);
      matrixRows.push(row);
    }

    // totals row
    const totalsRow: (string | number)[] = ["Total"];
    perEventYes.forEach((n) => totalsRow.push(n));
    totalsRow.push(perEventYes.reduce((s, n) => s + n, 0));
    matrixRows.push(totalsRow);

    // Venue % split (by NUMBER OF EVENTS)
    const venueCounts: Record<string, number> = {};
    for (const ev of events) {
      const v = venueLabel(ev);
      venueCounts[v] = (venueCounts[v] || 0) + 1;
    }
    const totalEvents = events.length;

    // Spacer + summary block at bottom
    matrixRows.push([]);
    matrixRows.push(["Venue usage (by events)"]);
    const venuesSorted = Object.entries(venueCounts).sort((a, b) => b[1] - a[1]);
    for (const [v, c] of venuesSorted) {
      const pct = totalEvents ? Math.round((c / totalEvents) * 100) : 0;
      matrixRows.push([v, c, `${pct}%`]);
    }

    // ----- SHEET 2: REASONS MISSING (per player) -----
    // Count reasons only for ABSENT
    const reasonsSet = new Set<string>();
    const perPlayerReason: Record<string, Record<string, number>> = {};

    for (const p of players) perPlayerReason[p.id] = {};

    for (const a of attendance) {
      if (!a.playerId) continue;
      if (!perPlayerReason[a.playerId]) perPlayerReason[a.playerId] = {};
      if (!isAbsent(a)) continue;

      const r = (a.reason || "No reason").trim() || "No reason";
      reasonsSet.add(r);
      perPlayerReason[a.playerId][r] = (perPlayerReason[a.playerId][r] || 0) + 1;
    }

    const reasonCols = Array.from(reasonsSet.values()).sort((a, b) => a.localeCompare(b));

    const reasonsRows: (string | number)[][] = [];
    reasonsRows.push(["Player", ...reasonCols, "Total Absent"]);

    for (const p of players) {
      const row: (string | number)[] = [p.name];
      let totalAbsent = 0;

      for (const r of reasonCols) {
        const n = perPlayerReason[p.id]?.[r] || 0;
        row.push(n);
        totalAbsent += n;
      }
      row.push(totalAbsent);
      reasonsRows.push(row);
    }

    // ----- BUILD XLSX -----
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(matrixRows);
    const ws2 = XLSX.utils.aoa_to_sheet(reasonsRows);

    XLSX.utils.book_append_sheet(wb, ws1, "Attendance Matrix");
    XLSX.utils.book_append_sheet(wb, ws2, "Reasons Missing");

    const fname = `${teamName.replace(/[^\w\s-]/g, "").trim() || "Team"}_Attendance.xlsx`;

    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fname;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
  return (
    <AppShell title="Admin" showNav={false}>
      <div className="py-10 text-sm text-neutral-600">Loading…</div>
    </AppShell>
  );
}

return (
  <AppShell title="Admin">
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Admin</h1>
        <div className="flex items-center gap-3">
          <Link href="/teams" className="text-sm font-semibold underline-offset-4 hover:underline">
            ← Teams
          </Link>
          <span className="text-xs text-neutral-500">UID: {uid}</span>
        </div>
      </div>

      {msg && (
        <div className="rounded-xl bg-neutral-100 p-3 text-sm text-neutral-800">
          {msg}
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Team
        </label>
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={exportExcel}
            className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Export Excel (.xlsx)
          </button>

          <span className="text-sm text-neutral-500">
            2 tabs: Attendance Matrix + Reasons Missing
          </span>
        </div>

        <div className="mt-3 text-sm text-neutral-600">
          Events: <strong>{events.length}</strong> • Players:{" "}
          <strong>{players.length}</strong> • Attendance records:{" "}
          <strong>{attendance.length}</strong>
        </div>
      </div>

      <div className="text-sm text-neutral-500">
        Tip: Venue is taken from the event’s <code>venue</code> field (Maryland / Tang / Other).
      </div>
    </div>
  </AppShell>
);
}
