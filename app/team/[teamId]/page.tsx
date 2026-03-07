"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "../../components/AppShell";

type Player = { id: string; name: string };
type Event = {
  id: string;
  type: string;
  date: any;
  attendancePresent?: number;
  attendanceTotal?: number;
};

export default function TeamPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = typeof params.teamId === "string" ? params.teamId : "";

  const [teamName, setTeamName] = useState<string>("Team");
  const [coachNames, setCoachNames] = useState<string[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


    const [topPlayers, setTopPlayers] = useState<any[]>([]);
    const [lowPlayers, setLowPlayers] = useState<any[]>([]);

  const [trainingPct, setTrainingPct] = useState(0);
  const [matchPct, setMatchPct] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");

        if (!teamId) {
          setError("Missing teamId from URL.");
          return;
        }

        // TEAM INFO
        const teamSnap = await getDoc(doc(db, "teams", teamId));
        if (teamSnap.exists()) {
          const data = teamSnap.data() as any;
          setTeamName(data?.name ?? teamId);
          setCoachNames(Array.isArray(data?.coachNames) ? data.coachNames : []);
        }

        // PLAYERS
        const pq = query(collection(db, "players"), where("teamId", "==", teamId));
        const playerSnap = await getDocs(pq);

        const playerList: Player[] = [];
        playerSnap.forEach((d) =>
          playerList.push({ id: d.id, ...(d.data() as any) })
        );
        playerList.sort((a, b) => a.name.localeCompare(b.name));
        setPlayers(playerList);

        // EVENTS (recent 3)
        const eq = query(
          collection(db, "events"),
          where("teamId", "==", teamId),
          orderBy("date", "desc"),
          limit(3)
        );

        const eventSnap = await getDocs(eq);
        const eventList: Event[] = [];

        eventSnap.forEach((d) => {
          eventList.push({ id: d.id, ...(d.data() as any) });
        });

        setEvents(eventList);

        // PLAYER ATTENDANCE ANALYSIS

const attendanceQuery = query(
  collection(db, "attendance"),
  where("teamId", "==", teamId)
);

const attendanceSnap = await getDocs(attendanceQuery);

const playerStats: any = {};

attendanceSnap.forEach((doc) => {
  const a: any = doc.data();
  const pid = a.playerId;

  if (!playerStats[pid]) {
    playerStats[pid] = { present: 0, total: 0 };
  }

  playerStats[pid].total++;

  if (a.status === "present") {
    playerStats[pid].present++;
  }
});
const playerAttendance = playerList.map((p) => {
  const stat = playerStats[p.id] || { present: 0, total: 0 };

  const pct =
    stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0;

  return {
    name: p.name,
    pct,
  };
});

playerAttendance.sort((a, b) => b.pct - a.pct);

setTopPlayers(playerAttendance.slice(0, 5));
setLowPlayers(playerAttendance.slice(-5).reverse());

        // CALCULATE ATTENDANCE %
        const allEventsQuery = query(
          collection(db, "events"),
          where("teamId", "==", teamId)
        );

        const allEventsSnap = await getDocs(allEventsQuery);

        let trainingPresent = 0;
        let trainingTotal = 0;
        let matchPresent = 0;
        let matchTotal = 0;

        allEventsSnap.forEach((doc) => {
          const e: any = doc.data();

          if (e.type === "training") {
            trainingPresent += e.attendancePresent ?? 0;
            trainingTotal += e.attendanceTotal ?? 0;
          }

          if (e.type === "match") {
            matchPresent += e.attendancePresent ?? 0;
            matchTotal += e.attendanceTotal ?? 0;
          }
        });

        setTrainingPct(
          trainingTotal > 0 ? Math.round((trainingPresent / trainingTotal) * 100) : 0
        );

        setMatchPct(
          matchTotal > 0 ? Math.round((matchPresent / matchTotal) * 100) : 0
        );
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [teamId]);

  function pctColor(pct: number) {
    if (pct >= 80) return "text-green-600";
    if (pct >= 60) return "text-amber-600";
    return "text-red-600";
  }

  return (
    <AppShell title={teamName}>
      {/* HEADER */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">{teamName}</h1>

            {coachNames.length > 0 && (
              <p className="text-sm text-neutral-600 mt-1">
                Coaches:{" "}
                <span className="font-medium">{coachNames.join(", ")}</span>
              </p>
            )}
          </div>

          <Link
            href="/teams"
            className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
          >
            ← Teams
          </Link>
        </div>

        <div className="mt-4 flex gap-2">
          <Link
            href={`/team/${teamId}/new`}
            className="rounded-full bg-[#1E3A8A] px-4 py-2 text-sm font-semibold text-white"
          >
            ➕ New Event
          </Link>

          <Link
            href={`/team/${teamId}/import-players`}
            className="rounded-full bg-[#7A0019] px-4 py-2 text-sm font-semibold text-white"
          >
            👥 Player Management
          </Link>
        </div>
      </div>

      {/* ATTENDANCE CARDS */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-neutral-500">Training Attendance</p>
          <p className={`text-2xl font-semibold ${pctColor(trainingPct)}`}>
            {trainingPct}%
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-neutral-500">Match Attendance</p>
          <p className={`text-2xl font-semibold ${pctColor(matchPct)}`}>
            {matchPct}%
          </p>
        </div>
      </div>

{/* PLAYER ATTENDANCE SUMMARY */}

<div className="mt-4 rounded-2xl border border-neutral-200 bg-white shadow-sm p-4">

  <h2 className="text-sm font-semibold text-neutral-800 mb-3">
    Player Attendance
  </h2>

  <div className="grid grid-cols-2 gap-4">

    {/* TOP ATTENDERS */}

    <div>
      <p className="text-xs text-neutral-500 mb-2">
        Top Attenders
      </p>

      {topPlayers?.length > 0 && topPlayers.map((p, i) => (
        <div
          key={i}
          className="flex justify-between items-center text-sm py-1"
        >
          <span className="text-neutral-800">
            {i + 1}. {p.name}
          </span>

          <span className="font-semibold text-green-600">
            {p.pct}%
          </span>
        </div>
      ))}
    </div>
    {topPlayers.length === 0 && (
  <p className="text-xs text-neutral-400">
    No attendance recorded yet
  </p>
)}

    {/* NEEDS ATTENTION */}

    <div>
      <p className="text-xs text-neutral-500 mb-2">
        Needs Attention
      </p>

      {lowPlayers?.length > 0 && lowPlayers.map((p, i) => (
        <div
          key={i}
          className="flex justify-between items-center text-sm py-1"
        >
          <span className="text-neutral-800">
            {i + 1}. {p.name}
          </span>

          <span className="font-semibold text-red-600">
            {p.pct}%
          </span>
        </div>
      ))}
    </div>
{lowPlayers.length === 0 && (
  <p className="text-xs text-neutral-400">
    No attendance recorded yet
  </p>
)}
  </div>

</div>

      {/* RECENT SESSIONS */}
      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {loading && <div className="p-4 text-sm">Loading...</div>}
        {!loading && error && <div className="p-4 text-red-700">{error}</div>}

        {!loading && !error && (
          <div className="p-4">
            <h2 className="text-sm font-semibold text-neutral-900 pb-2 border-b border-neutral-200 mb-3">
  Recent Sessions & Matches <br></br>
  (click to reopen and edit)
</h2>

            {events.length === 0 && (
              <p className="text-sm text-neutral-500">
                No sessions logged yet.
              </p>
            )}

            <ul className="divide-y divide-neutral-200">
              {events.map((e) => {
                const eventType = (e.type || "").toLowerCase();

                const present = e.attendancePresent ?? 0;
                const total = e.attendanceTotal ?? players.length;

                return (
                  <li
                    key={e.id}
                    onClick={() => router.push(`/event/${e.id}`)}
                    className="flex items-center justify-between py-4 px-3 cursor-pointer hover:bg-neutral-100"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          eventType === "training"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {e.type?.charAt(0).toUpperCase() + e.type?.slice(1)}
                      </span>

                      <span className="text-sm text-neutral-600">
                        {e.date
                          ? new Date(
                              e.date.seconds
                                ? e.date.seconds * 1000
                                : e.date
                            ).toLocaleDateString("en-IE", {
                              day: "numeric",
                              month: "short",
                            })
                          : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-neutral-800">
                        {present} / {total}
                      </span>

                      <span className="text-neutral-400 text-base">›</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}