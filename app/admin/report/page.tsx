"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminReport() {
  const [teams, setTeams] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [comments, setComments] = useState("");

  useEffect(() => {
    (async () => {
      const teamSnap = await getDocs(collection(db, "teams"));
      const playerSnap = await getDocs(collection(db, "players"));
      const eventSnap = await getDocs(collection(db, "events"));
      const attendanceSnap = await getDocs(collection(db, "attendance"));

      const teamList = teamSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const order = ["Nursery", "U8", "U08", "U10", "U12", "U14", "U16", "U18", "U20"];

      teamList.sort((a, b) => {
        const aIndex = order.indexOf((a.name || "").toUpperCase());
        const bIndex = order.indexOf((b.name || "").toUpperCase());
        return aIndex - bIndex;
      });

      setTeams(teamList);
      setPlayers(playerSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setEvents(eventSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setAttendance(attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  // =========================
  // DEDUPLICATE PLAYERS
  // =========================
  const seenNames = new Set<string>();
  const dedupedPlayers = players.filter((p) => {
    const key = (p.name || "").toLowerCase().trim();
    if (!key || seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });

  const uniquePlayerCount = dedupedPlayers.length;

  // =========================
  // PLAYER ATTENDANCE MAP
  // =========================
  const playerStats: Record<string, { present: number; total: number }> = {};

  attendance.forEach(a => {
    const pid = a.playerId;
    if (!playerStats[pid]) playerStats[pid] = { present: 0, total: 0 };
    playerStats[pid].total++;
    if (a.status === "Present") playerStats[pid].present++;
  });

  // =========================
  // CLUB TOTALS
  // =========================
  let totalPresent = 0;
  let totalAttendance = 0;
  let wins = 0, losses = 0, draws = 0;

  events.forEach(e => {
    totalPresent += e.attendancePresent ?? 0;
    totalAttendance += e.attendanceTotal ?? 0;
    if (e.result === "W") wins++;
    if (e.result === "L") losses++;
    if (e.result === "D") draws++;
  });

  const avgAttendance =
    totalAttendance > 0 ? Math.round((totalPresent / totalAttendance) * 100) : 0;

  let activePlayers = 0;
  let inactivePlayers = 0;
  let noSessionPlayers = 0;

  const teamsWithSessions = new Set(events.map((e) => e.teamId));

  dedupedPlayers.forEach(p => {
    const stat = playerStats[p.id] || { present: 0, total: 0 };
    const pct = stat.total > 0 ? stat.present / stat.total : 0;
    const hasSessions = teamsWithSessions.has(p.teamId);
    if (!hasSessions) noSessionPlayers++;
    else if (stat.total === 0 || pct < 0.1) inactivePlayers++;
    else activePlayers++;
  });

  // =========================
  // TEAM ANALYSIS
  // =========================
  const teamAnalysis = teams.map(team => {
    const teamPlayers = dedupedPlayers.filter(p => p.teamId === team.id);
    const teamEvents = events.filter(e => e.teamId === team.id);

    let present = 0;
    let total = 0;
    teamEvents.forEach(e => {
      present += e.attendancePresent ?? 0;
      total += e.attendanceTotal ?? 0;
    });

    const attendancePct = total > 0 ? Math.round((present / total) * 100) : 0;

    let w = 0, l = 0, d = 0;
    teamEvents.forEach(e => {
      if (e.result === "W") w++;
      if (e.result === "L") l++;
      if (e.result === "D") d++;
    });

    const lastEvent = teamEvents
      .slice()
      .sort((a, b) => {
        const da = a.date?.seconds ? a.date.seconds : new Date(a.date).getTime();
        const db2 = b.date?.seconds ? b.date.seconds : new Date(b.date).getTime();
        return db2 - da;
      })[0];

    const lastSessionDate = lastEvent
      ? new Date(
          lastEvent.date?.seconds ? lastEvent.date.seconds * 1000 : lastEvent.date
        ).toLocaleDateString("en-IE")
      : "—";

    let maryland = 0;
    let tang = 0;
    teamEvents.forEach(e => {
      const venue = (e.venue || "").toLowerCase();
      if (venue.includes("maryland")) maryland++;
      if (venue.includes("tang")) tang++;
    });

    const inactiveCount = teamPlayers.filter(p => {
      const stat = playerStats[p.id] || { present: 0, total: 0 };
      const pct = stat.total > 0 ? stat.present / stat.total : 0;
      return pct < 0.1;
    }).length;

    return {
      name: team.name,
      players: teamPlayers.length,
      sessions: teamEvents.length,
      attendancePct,
      record: `${w}-${l}-${d}`,
      inactiveCount,
      lastSessionDate,
      maryland,
      tang
    };
  });

  // =========================
  // INSIGHTS
  // =========================
  const concerns: string[] = [];
  const positives: string[] = [];

  teamAnalysis.forEach(t => {
    if (t.sessions === 0) return;
    if (t.attendancePct < 60) concerns.push(`${t.name}: Low attendance (${t.attendancePct}%)`);
    if (t.sessions < 3) concerns.push(`${t.name}: Low activity`);
    if (t.sessions >= 5 && t.inactiveCount > 3) concerns.push(`${t.name}: High inactive players (${t.inactiveCount})`);
    if (t.attendancePct >= 60) positives.push(`${t.name}: Positive attendance (${t.attendancePct}%)`);
    if (t.sessions >= 10) positives.push(`${t.name}: High activity`);
    if (t.record.startsWith("3") || t.record.startsWith("4")) positives.push(`${t.name}: Strong results`);
  });

  return (
    <div className="p-6 bg-white text-black max-w-4xl mx-auto">

      {/* PRINT BUTTON */}
      <div className="mb-4 flex justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg border px-4 py-2 text-sm font-semibold bg-white hover:bg-neutral-100"
        >
          🖨 Print / Save PDF
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-2">Maryland/Tang Performance Report</h1>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div><strong>Teams:</strong> {teams.length}</div>
        <div>
          <strong>Players:</strong> {uniquePlayerCount}
          {uniquePlayerCount !== players.length && (
            <span className="ml-2 text-amber-500 text-xs">
              ({players.length - uniquePlayerCount} duplicate{players.length - uniquePlayerCount > 1 ? "s" : ""} across teams)
            </span>
          )}
        </div>
        <div><strong>Sessions (Training &amp; Matches):</strong> {events.length}</div>
        <div><strong>Avg Attendance:</strong> {avgAttendance}%</div>
        <div><strong>Active Players:</strong> {activePlayers}</div>
        <div>
          <strong>Inactive / No Sessions:</strong> {inactivePlayers + noSessionPlayers}
          <span className="ml-2 text-xs text-neutral-500">
            ({inactivePlayers} inactive · {noSessionPlayers} no sessions yet)
          </span>
        </div>
        <div><strong>Record (W/L/D):</strong> {wins}-{losses}-{draws}</div>
      </div>

      {/* CONCERNS */}
      <h2 className="font-semibold mb-2">Key Concerns</h2>
      {concerns.map((c, i) => (
        <p key={i} className="text-sm text-red-700">• {c}</p>
      ))}

      {/* POSITIVES */}
      <h2 className="font-semibold mt-4 mb-2">Positive Highlights</h2>
      {positives.map((p, i) => (
        <p key={i} className="text-sm text-green-700">• {p}</p>
      ))}

      {/* TABLE */}
      <h2 className="font-semibold mt-6 mb-2">Team Breakdown</h2>
      <table className="w-full text-sm border border-neutral-300">
        <thead className="bg-neutral-100">
          <tr>
            <th className="p-2 text-left">Team</th>
            <th className="p-2">Players (Within Age)</th>
            <th className="p-2">Sessions</th>
            <th className="p-2">Attendance</th>
            <th className="p-2">Record</th>
            <th className="p-2">Inactive</th>
            <th className="p-2">Last Session</th>
            <th className="p-2">Venue Usage</th>
          </tr>
        </thead>
        <tbody>
          {teamAnalysis.map((t, i) => (
            <tr key={i} className="border-t">
              <td className="p-2">{t.name}</td>
              <td className="p-2 text-center">{t.players}</td>
              <td className="p-2 text-center">{t.sessions}</td>
              <td className="p-2 text-center">{t.attendancePct}%</td>
              <td className="p-2 text-center">{t.record}</td>
              <td className="p-2 text-center">{t.inactiveCount}</td>
              <td className="p-2 text-center">{t.lastSessionDate}</td>
              <td className="p-2 text-center">M:{t.maryland} / T:{t.tang}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* SECRETARY COMMENTS */}
      <h2 className="font-semibold mt-6 mb-2">Secretary Comments</h2>

      {/* Editable — hidden when printing */}
      <textarea
        className="w-full border border-neutral-300 rounded p-2 text-sm print:hidden resize-none"
        rows={6}
        placeholder="Add additional comments here before printing..."
        value={comments}
        onChange={(e) => setComments(e.target.value)}
      />

      {/* Printed version */}
      <div className="hidden print:block border border-neutral-300 rounded p-3 text-sm min-h-[120px] whitespace-pre-wrap">
        {comments}
      </div>

    </div>
  );
}
