"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "../../components/AppShell";

type Team = { id: string; name: string };

export default function AdminDashboard() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const teamSnap = await getDocs(collection(db, "teams"));
      const playerSnap = await getDocs(collection(db, "players"));
      const eventSnap = await getDocs(collection(db, "events"));
      const attendanceSnap = await getDocs(collection(db, "attendance"));

      const teamList: Team[] = [];
      teamSnap.forEach((d) =>
        teamList.push({ id: d.id, ...(d.data() as any) })
      );

      const order = ["Nursery", "U08", "U10", "U12", "U14", "U16", "U18", "U20"];

      teamList.sort((a, b) => {
        const aIndex = order.indexOf(a.name);
        const bIndex = order.indexOf(b.name);
        return aIndex - bIndex;
      });

      const playerList: any[] = [];
      playerSnap.forEach((d) =>
        playerList.push({ id: d.id, ...(d.data() as any) })
      );

      const eventList: any[] = [];
      eventSnap.forEach((d) =>
        eventList.push({ id: d.id, ...(d.data() as any) })
      );

      const attendanceList: any[] = [];
      attendanceSnap.forEach((d) =>
        attendanceList.push({ id: d.id, ...(d.data() as any) })
      );

      setTeams(teamList);
      setPlayers(playerList);
      setEvents(eventList);
      setAttendance(attendanceList);

      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <AppShell title="Admin Dashboard">
        <div className="p-4 text-sm text-neutral-600">
          Loading dashboard…
        </div>
      </AppShell>
    );
  }

  // 🔹 PLAYER ATTENDANCE
  const teamsWithSessions = new Set(events.map((e) => e.teamId));

  const playerStats: Record<string, { present: number; total: number }> = {};

  attendance.forEach((a) => {
    const pid = a.playerId;
    if (!playerStats[pid]) {
      playerStats[pid] = { present: 0, total: 0 };
    }
    playerStats[pid].total++;
    if (a.status === "Present") {
      playerStats[pid].present++;
    }
  });

  // 🔹 DEDUPLICATE PLAYERS by name before all calculations
  const seenNames = new Set<string>();
  const dedupedPlayers = players.filter((p) => {
    const key = (p.name || "").toLowerCase().trim();
    if (!key || seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });

  const uniquePlayerCount = dedupedPlayers.length;

  // 🔹 CLUB TOTALS (using deduped players)
  let activePlayers = 0;
  let inactivePlayers = 0;
  let noSessionPlayers = 0;

  dedupedPlayers.forEach((p) => {
    const stat = playerStats[p.id] || { present: 0, total: 0 };
    const pct = stat.total > 0 ? stat.present / stat.total : 0;
    const hasSessions = teamsWithSessions.has(p.teamId);

    if (!hasSessions) {
      noSessionPlayers++;
    } else if (stat.total === 0 || pct < 0.1) {
      inactivePlayers++;
    } else {
      activePlayers++;
    }
  });

  const avgInactivePerTeam =
    teams.length > 0 ? inactivePlayers / teams.length : 0;

  // 🔹 SORT EVENTS — renamed inner variable to avoid shadowing `db` import
  const sortedEvents = [...events].sort((a, b) => {
    const da = a.date?.seconds ? a.date.seconds : new Date(a.date).getTime();
    const db2 = b.date?.seconds ? b.date.seconds : new Date(b.date).getTime();
    return db2 - da;
  });

  return (
    <AppShell title="Admin Dashboard">
      <div className="p-4">

        <h1 className="text-xl font-semibold text-neutral-900 mb-4">
          Club Dashboard
        </h1>

        {/* SUMMARY */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl bg-white border p-3 shadow-sm">
            <p className="text-xs text-neutral-500">Teams</p>
            <p className="text-lg font-semibold">{teams.length}</p>
          </div>

          <div className="rounded-xl bg-white border p-3 shadow-sm">
            <p className="text-xs text-neutral-500">Players</p>
            <p className="text-lg font-semibold">{uniquePlayerCount}</p>
            {uniquePlayerCount !== players.length && (
              <p className="text-xs text-amber-500 mt-1">
                {players.length - uniquePlayerCount} duplicate{players.length - uniquePlayerCount > 1 ? "s" : ""} across teams
              </p>
            )}
          </div>

          <div className="rounded-xl bg-white border p-3 shadow-sm">
            <p className="text-xs text-neutral-500">Active Players</p>
            <p className="text-lg font-semibold text-emerald-600">
              {activePlayers}
            </p>
          </div>

          <div className="rounded-xl bg-white border p-3 shadow-sm">
            <p className="text-xs text-neutral-500">Inactive / No Sessions</p>
            <p className="text-lg font-semibold text-red-600">
              {inactivePlayers + noSessionPlayers}
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              {inactivePlayers} inactive · {noSessionPlayers} no sessions yet
            </p>
          </div>
        </div> {/* ✅ CLOSE SUMMARY GRID */}

        {/* TEAM GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => {

            const teamPlayers = dedupedPlayers.filter(p => p.teamId === team.id);
            const teamEvents = events.filter(e => e.teamId === team.id);

            const trainingSessions = teamEvents.filter((e) => e.type === "training");
            const matches = teamEvents.filter((e) => e.type !== "training");
            const trainingCount = trainingSessions.length;
            const matchCount = matches.length;

            const recentEvents = sortedEvents
              .filter(e => e.teamId === team.id)
              .slice(0, 3);

            const playersMissing3 = teamPlayers.filter((p) => {
              const records = attendance.filter(
                (a) =>
                  a.playerId === p.id &&
                  recentEvents.some((e) => e.id === a.eventId)
              );
              if (records.length === 0) return true;
              return records.every((r) => r.status !== "Present");
            });

            const missingCount = playersMissing3.length;

            let present = 0;
            let total = 0;

            teamEvents.forEach(e => {
              present += e.attendancePresent ?? 0;
              total += e.attendanceTotal ?? 0;
            });

            const attendancePct =
              total > 0 ? Math.round((present / total) * 100) : 0;

            let statusColor = "bg-neutral-100";
            if (attendancePct > 75) {
              statusColor = "bg-emerald-100";
            } else if (attendancePct >= 50) {
              statusColor = "bg-amber-100";
            } else {
              statusColor = "bg-red-100";
            }

            let wins = 0, losses = 0, draws = 0;
            teamEvents.forEach(e => {
              if (e.result === "W") wins++;
              if (e.result === "L") losses++;
              if (e.result === "D") draws++;
            });

            const inactiveCount = teamPlayers.filter(p => {
              const stat = playerStats[p.id] || { present: 0, total: 0 };
              const pct = stat.total > 0 ? stat.present / stat.total : 0;
              return pct < 0.1;
            }).length;

            // 🔹 VENUE SPLIT
            let maryland = 0;
            let tang = 0;
            teamEvents.forEach(e => {
              const venue = (e.venue || "").toLowerCase();
              if (venue.includes("maryland")) maryland++;
              if (venue.includes("tang")) tang++;
            });

            // 🔹 SIGNALS
            const signals: string[] = [];
            if (missingCount > 0)
              signals.push(`⚠ ${missingCount} missed last 3 sessions`);
            if (attendancePct < 50)
              signals.push("⚠ Low attendance");
            if (teamEvents.length === 0)
              signals.push("⚠ No sessions logged");
            if (inactiveCount > avgInactivePerTeam)
              signals.push("⚠ High inactive players");
            if (attendancePct >= 60)
              signals.push("🔥 Positive attendance");

            return (
              <div
                key={team.id}
                className={`rounded-2xl border border-neutral-200 ${statusColor} p-4 shadow-sm`}
              >
                <h2 className="text-lg font-semibold">{team.name}</h2>
                <div className="my-2 border-t border-neutral-300"></div>

                <div className="mt-2 text-lg">
                  Attendance: <strong>{attendancePct}%</strong>
                </div>
                <div className="my-2 border-t border-neutral-300"></div>

                <div className="text-sm">Total Players: {teamPlayers.length}</div>
                <div className="text-sm"># Players Missed Last 3 Sessions: {missingCount}</div>
                <div className="text-sm">Inactive Players: {inactiveCount}</div>
                <div className="my-2 border-t border-neutral-300"></div>

                <div className="text-sm">
                  Training Sessions: <strong>{trainingCount}</strong>
                </div>
                <div className="text-sm">
                  Matches: <strong>{matchCount}</strong>
                </div>
                <div className="text-sm">W/L/D Record: {wins}-{losses}-{draws}</div>
                <div className="my-2 border-t border-neutral-300"></div>

                <div className="text-sm">
                  Venue Split: M:{maryland} / T:{tang}
                </div>
                <div className="my-2 border-t border-neutral-300"></div>

                <div className="mt-2 space-y-1">
                  {signals.map((s, i) => (
                    <div key={i} className="text-xs">{s}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
