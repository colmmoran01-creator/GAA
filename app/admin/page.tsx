"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";

type Team = { id: string; name: string; season: string };
type Player = { id: string; name: string; teamId: string };
type Event = { id: string; teamId: string; type: string; date: string; venue: string };
type Attendance = {
  eventId: string;
  playerId: string;
  status: string; // "present" | "absent" | "late" | "injured"
  reason?: string | null;
};

// --- CSV helper ---
function downloadCSV(filename: string, rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Nice title for event type
function prettyType(t: string) {
  const x = (t || "").toLowerCase();
  if (x === "training") return "Training";
  if (x === "match") return "Match";
  if (x === "challenge") return "Challenge";
  return t || "Event";
}

export default function AdminPage() {
  const [uid, setUid] = useState<string | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string>("");

  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === teamId) ?? null,
    [teams, teamId]
  );

  // Load teams where this user is an ADMIN
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUid(null);
        setTeams([]);
        setTeamId("");
        setLoading(false);
        setMsg("Not logged in. Go to /login");
        return;
      }

      setUid(user.uid);

      const tSnap = await getDocs(
        query(collection(db, "teams"), where("adminUids", "array-contains", user.uid))
      );

      const list: Team[] = [];
      tSnap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      list.sort((a, b) => a.name.localeCompare(b.name));

      setTeams(list);
      setTeamId(list[0]?.id ?? "");
      setLoading(false);
      setMsg("");
    });
  }, []);

  // Load players + events + attendance for selected team
  useEffect(() => {
    (async () => {
      if (!teamId) return;

      try {
        setMsg("Loading data…");

        // Players
        const pSnap = await getDocs(query(collection(db, "players"), where("teamId", "==", teamId)));
        const plist: Player[] = [];
        pSnap.forEach((d) => plist.push({ id: d.id, ...(d.data() as any) }));
        plist.sort((a, b) => a.name.localeCompare(b.name));
        setPlayers(plist);

        // Events (orderBy date needs index; you already created it)
        const eSnap = await getDocs(
          query(collection(db, "events"), where("teamId", "==", teamId), orderBy("date", "desc"))
        );
        const elist: Event[] = [];
        eSnap.forEach((d) => elist.push({ id: d.id, ...(d.data() as any) }));
        setEvents(elist);

        // Attendance for those events (chunked 'in' query, max 30)
        const eventIds = elist.map((e) => e.id);
        const attAll: Attendance[] = [];
        const chunkSize = 30;

        for (let i = 0; i < eventIds.length; i += chunkSize) {
          const chunk = eventIds.slice(i, i + chunkSize);
          if (chunk.length === 0) continue;

          const aSnap = await getDocs(
            query(collection(db, "attendance"), where("eventId", "in", chunk))
          );
          aSnap.forEach((d) => attAll.push(d.data() as any));
        }

        setAttendance(attAll);
        setMsg("");
      } catch (e: any) {
        console.error(e);
        setMsg(`Error loading data: ${e?.message ?? String(e)}`);
      }
    })();
  }, [teamId]);

  // Attendance % per player (missing attendance doc counts as present)
  const playerStats = useMemo(() => {
    const totalEvents = events.length || 0;
    const absentCountByPlayer = new Map<string, number>();

    for (const a of attendance) {
      if (a.status === "absent") {
        absentCountByPlayer.set(a.playerId, (absentCountByPlayer.get(a.playerId) ?? 0) + 1);
      }
    }

    return players
      .map((p) => {
        const absent = absentCountByPlayer.get(p.id) ?? 0;
        const attended = Math.max(0, totalEvents - absent);
        const pct = totalEvents ? Math.round((attended / totalEvents) * 100) : 0;
        return { playerId: p.id, name: p.name, attended, total: totalEvents, pct };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [players, events, attendance]);

  // Absence reasons summary
  const reasonStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of attendance) {
      if (a.status !== "absent") continue;
      const r = (a.reason ?? "—").toString();
      map.set(r, (map.get(r) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [attendance]);

  // --- NEW: Attendance Matrix export (type row + date row + Yes/No grid + totals) ---
  function exportAttendanceMatrixCSV() {
    if (!selectedTeam) return;

    // Columns should grow as events grow. Put them in chronological order left->right.
    const eventsAsc = [...events].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    // Build a lookup: eventId -> playerId -> status
    // Missing record => present (YES)
    const statusByEventPlayer = new Map<string, Map<string, string>>();
    for (const a of attendance) {
      if (!statusByEventPlayer.has(a.eventId)) statusByEventPlayer.set(a.eventId, new Map());
      statusByEventPlayer.get(a.eventId)!.set(a.playerId, a.status);
    }

    const headerRow1: (string | number)[] = ["Player", ...eventsAsc.map((e) => prettyType(e.type)), "Total Attended"];
    const headerRow2: (string | number)[] = ["", ...eventsAsc.map((e) => e.date), ""];

    const rows: (string | number)[][] = [headerRow1, headerRow2];

    // Player rows
    for (const p of players) {
      let attendedCount = 0;

      const cells: (string | number)[] = [];
      for (const ev of eventsAsc) {
        const st = statusByEventPlayer.get(ev.id)?.get(p.id);

        // Yes if not explicitly absent
        const yes = st !== "absent";
        cells.push(yes ? "Yes" : "No");
        if (yes) attendedCount += 1;
      }

      rows.push([p.name, ...cells, attendedCount]);
    }

    // Totals row at bottom
    const totalYesPerEvent: number[] = eventsAsc.map(() => 0);
    let grandTotalYes = 0;

    // Walk player rows we just made (skip two header rows)
    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      // event columns start at index 1
      for (let c = 0; c < eventsAsc.length; c++) {
        const v = row[1 + c];
        if (v === "Yes") {
          totalYesPerEvent[c] += 1;
          grandTotalYes += 1;
        }
      }
    }

    rows.push(["TOTAL", ...totalYesPerEvent, grandTotalYes]);

    const safeTeam = selectedTeam.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_");
    downloadCSV(`${safeTeam}_attendance_matrix.csv`, rows);
  }

  if (loading) return <main style={{ padding: 16 }}>Loading…</main>;
  if (!uid) return <main style={{ padding: 16 }}>{msg || "Not logged in."}</main>;

  return (
    <main style={{ maxWidth: 980, margin: "24px auto", padding: 16 }}>
      <h1>Admin Reports</h1>

      {teams.length === 0 ? (
        <p>No admin teams found for your user (check adminUids on teams).</p>
      ) : (
        <>
          <label>Team</label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            style={{ width: "100%", padding: 10, margin: "6px 0 14px" }}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (Season {t.season})
              </option>
            ))}
          </select>

          <p style={{ opacity: 0.75, marginTop: 0 }}>
            Players: <strong>{players.length}</strong> • Events: <strong>{events.length}</strong> • Attendance records saved:{" "}
            <strong>{attendance.length}</strong>
          </p>

          {msg && <p>{msg}</p>}

          {/* CSV EXPORT BUTTONS */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "10px 0 16px" }}>
            <button
              onClick={() => {
                const rows: (string | number)[][] = [
                  ["Team", "Player", "Attended", "Total", "Percent"],
                  ...playerStats.map((r) => [selectedTeam?.name ?? "", r.name, r.attended, r.total, r.pct]),
                ];
                const safeTeam = (selectedTeam?.name ?? "team").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_");
                downloadCSV(`${safeTeam}_attendance_summary.csv`, rows);
              }}
              style={{ padding: 10 }}
            >
              Export Attendance Summary (CSV)
            </button>

            <button
              onClick={() => {
                const rows: (string | number)[][] = [
                  ["Team", "Reason", "Count"],
                  ...reasonStats.map(([reason, count]) => [selectedTeam?.name ?? "", reason, count]),
                ];
                const safeTeam = (selectedTeam?.name ?? "team").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_");
                downloadCSV(`${safeTeam}_absence_reasons.csv`, rows);
              }}
              style={{ padding: 10 }}
            >
              Export Absence Reasons (CSV)
            </button>

            <button
              onClick={exportAttendanceMatrixCSV}
              style={{ padding: 10, fontWeight: 700 }}
            >
              Export Attendance Matrix (CSV)
            </button>
          </div>

          <h2>Attendance % per player</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Player</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Attended</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Total</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>%</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.map((r) => (
                <tr key={r.playerId}>
                  <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>{r.name}</td>
                  <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8, textAlign: "right" }}>{r.attended}</td>
                  <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8, textAlign: "right" }}>{r.total}</td>
                  <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8, textAlign: "right" }}>{r.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ marginTop: 24 }}>Absence reasons</h2>
          {reasonStats.length === 0 ? (
            <p>No absences recorded yet.</p>
          ) : (
            <ul>
              {reasonStats.map(([reason, count]) => (
                <li key={reason}>
                  {reason}: <strong>{count}</strong>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
