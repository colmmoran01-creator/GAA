"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "../components/AppShell";
import * as XLSX from "xlsx-js-style";

type Team = { id: string; name: string };
type Player = { id: string; name: string };
type EventDoc = {
  id: string;
  teamId: string;
  type: string;
  date: string; // YYYY-MM-DD
  venue?: string;
  opposition?: string;
  teamGoals?: number;
  teamPoints?: number;
  oppGoals?: number;
  oppPoints?: number;
};
type AttendanceDoc = {
  id: string;
  teamId?: string;
  eventId: string;
  playerId: string;
  status?: string; // "Present" | "Absent"
  reason?: string;
  present?: boolean;
};

type CanonType =
  | "training"
  | "league_match"
  | "championship_match"
  | "challenge_match"
  | "go_games";

// --- Type helpers (supports legacy values too) ---
function normalizeType(t: any): CanonType {
  if (t === "match") return "league_match";
  if (t === "challenge") return "challenge_match";
  if (t === "league_match" || t === "championship_match" || t === "challenge_match" || t === "training" || t === "go_games") return t;
  return "training";
}

function typeLabel(t: any) {
  const nt = normalizeType(t);
  switch (nt) {
    case "training": return "Training";
    case "league_match": return "League Match";
    case "championship_match": return "Championship Match";
    case "challenge_match": return "Challenge Match";
    case "go_games": return "Go Games";
  }
}

function isMatchType(t: any) {
  const nt = normalizeType(t);
  return nt === "league_match" || nt === "championship_match" || nt === "challenge_match";
}

function isGoGames(t: any) {
  return normalizeType(t) === "go_games";
}

function eventFillRGB(t: any) {
  // pastel fills for readability
  const nt = normalizeType(t);
  switch (nt) {
    case "training": return "D9EAFD";           // light blue
    case "league_match": return "DDF7E3";       // light green
    case "championship_match": return "FFF2CC"; // light gold
    case "challenge_match": return "FADBD8";    // light red
    case "go_games": return "EFE1FF";           // light purple
  }
}

function pct(n: number) {
  if (!isFinite(n)) return "";
  return `${Math.round(n * 100)}%`;
}

function scoreString(e: EventDoc) {
  const tg = e.teamGoals;
  const tp = e.teamPoints;
  const og = e.oppGoals;
  const op = e.oppPoints;
  if (tg === undefined || tp === undefined || og === undefined || op === undefined) return "";
  return `${tg}-${tp} vs ${og}-${op}`;
}

function styleHeader(fillRgb: string) {
  return {
    font: { bold: true, color: { rgb: "111827" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    fill: { patternType: "solid", fgColor: { rgb: fillRgb } },
    border: {
      top: { style: "thin", color: { rgb: "E5E7EB" } },
      bottom: { style: "thin", color: { rgb: "E5E7EB" } },
      left: { style: "thin", color: { rgb: "E5E7EB" } },
      right: { style: "thin", color: { rgb: "E5E7EB" } },
    },
  };
}

function styleBody() {
  return {
    font: { color: { rgb: "111827" } },
    alignment: { vertical: "center", wrapText: true },
    border: {
      bottom: { style: "thin", color: { rgb: "F3F4F6" } },
    },
  };
}

export default function AdminPage() {
  const router = useRouter();

  const [uid, setUid] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string>("");

  const [events, setEvents] = useState<EventDoc[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [attendance, setAttendance] = useState<AttendanceDoc[]>([]);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // --- Auth + load accessible teams (admin OR coach) ---
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      setUid(user.uid);

      setLoading(true);
      setErr("");
      setMsg("");

      try {
        // admin teams
        const qAdmin = query(collection(db, "teams"), where("adminUids", "array-contains", user.uid));
        // coach teams
        const qCoach = query(collection(db, "teams"), where("coachUids", "array-contains", user.uid));

        const [snapAdmin, snapCoach] = await Promise.all([getDocs(qAdmin), getDocs(qCoach)]);

        const map = new Map<string, Team>();
        snapAdmin.forEach((d) => {
          const data = d.data() as any;
          map.set(d.id, { id: d.id, name: data?.name ?? d.id });
        });
        snapCoach.forEach((d) => {
          const data = d.data() as any;
          map.set(d.id, { id: d.id, name: data?.name ?? d.id });
        });

        const list = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
        setTeams(list);

        if (list.length > 0) setTeamId((prev) => prev || list[0].id);
      } catch (e: any) {
        console.error(e);
        setErr(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  // --- Load events/players/attendance for selected team ---
  useEffect(() => {
    (async () => {
      if (!teamId) return;

      setLoading(true);
      setErr("");
      setMsg("");

      try {
        // Events (ordered by date)
        const qEvents = query(
          collection(db, "events"),
          where("teamId", "==", teamId),
          orderBy("date", "asc")
        );
        const snapE = await getDocs(qEvents);
        const ev: EventDoc[] = [];
        snapE.forEach((d) => ev.push({ id: d.id, ...(d.data() as any) }));
        setEvents(ev);

        // Players
        const qPlayers = query(collection(db, "players"), where("teamId", "==", teamId));
        const snapP = await getDocs(qPlayers);
        const pl: Player[] = [];
        snapP.forEach((d) => pl.push({ id: d.id, ...(d.data() as any) }));
        pl.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
        setPlayers(pl);

        // Attendance (assumes attendance docs include teamId — your earlier export worked this way)
        const qAtt = query(collection(db, "attendance"), where("teamId", "==", teamId));
        const snapA = await getDocs(qAtt);
        const at: AttendanceDoc[] = [];
        snapA.forEach((d) => at.push({ id: d.id, ...(d.data() as any) }));
        setAttendance(at);
      } catch (e: any) {
        console.error(e);
        setErr(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [teamId]);

  const stats = useMemo(() => {
    return {
      events: events.length,
      players: players.length,
      attendance: attendance.length,
    };
  }, [events.length, players.length, attendance.length]);

  function exportExcel() {
    try {
      setErr("");
      setMsg("");

      if (!teamId) return;

      const ev = [...events].sort((a, b) => String(a.date).localeCompare(String(b.date)));

      // attendance[eventId][playerId] = present boolean
      const attMap = new Map<string, Map<string, boolean>>();
      for (const a of attendance) {
        if (!a.eventId || !a.playerId) continue;
        const present =
          (a.status ?? "").toLowerCase() === "present" || a.present === true;

        if (!attMap.has(a.eventId)) attMap.set(a.eventId, new Map());
        attMap.get(a.eventId)!.set(a.playerId, present);
      }

      // meta rows per event column
      const eventTypeRow = ["Event type", ...ev.map((e) => typeLabel(e.type))];
      const dateRow = ["Date", ...ev.map((e) => e.date ?? "")];
      const venueRow = ["Venue", ...ev.map((e) => e.venue ?? "")];
      const oppRow = ["Opposition", ...ev.map((e) => e.opposition ?? "")];
      const scoreRow = [
        "Score",
        ...ev.map((e) => (isMatchType(e.type) ? scoreString(e) : "")),
      ];

      // matrix rows
      const playerRows: (string | number)[][] = [];
      const presentCounts = new Array(ev.length).fill(0);

      for (const p of players) {
        const row: (string | number)[] = [p.name ?? ""];
        ev.forEach((e, idx) => {
          const present = attMap.get(e.id)?.get(p.id) === true;
          if (present) presentCounts[idx] += 1;
          row.push(present ? "Yes" : "No");
        });
        playerRows.push(row);
      }

      const totalRow: (string | number)[] = ["Total present", ...presentCounts];
      const pctRow: (string | number)[] = [
        "% attendance",
        ...presentCounts.map((c) => (players.length ? pct(c / players.length) : "")),
      ];

      // summary block
      const buckets = {
        training: 0,
        league_match: 0,
        championship_match: 0,
        challenge_match: 0,
        go_games: 0,
      };
      const presentTotalsByType = { ...buckets };
      const slotsByType = { ...buckets };

      ev.forEach((e, idx) => {
        const t = normalizeType(e.type);
        buckets[t] += 1;
        presentTotalsByType[t] += presentCounts[idx];
        slotsByType[t] += players.length;
      });

      const totalEvents = ev.length;
      const totalPresent = presentCounts.reduce((a, b) => a + b, 0);
      const totalSlots = totalEvents * players.length;
      const overallAvg = totalSlots ? totalPresent / totalSlots : 0;

      // per-player split: training vs matches vs go games
      const trainingIds = ev.filter((e) => normalizeType(e.type) === "training").map((e) => e.id);
      const matchIds = ev.filter((e) => isMatchType(e.type)).map((e) => e.id);
      const goIds = ev.filter((e) => isGoGames(e.type)).map((e) => e.id);

      const perPlayerSplitRows: (string | number)[][] = [];
      for (const p of players) {
        const countPresent = (ids: string[]) =>
          ids.reduce(
            (acc, id) => acc + (attMap.get(id)?.get(p.id) === true ? 1 : 0),
            0
          );

        const trP = countPresent(trainingIds);
        const maP = countPresent(matchIds);
        const goP = countPresent(goIds);

        const trPct = trainingIds.length ? trP / trainingIds.length : NaN;
        const maPct = matchIds.length ? maP / matchIds.length : NaN;
        const goPct = goIds.length ? goP / goIds.length : NaN;

        perPlayerSplitRows.push([
          p.name ?? "",
          trainingIds.length, trP, pct(trPct),
          matchIds.length, maP, pct(maPct),
          goIds.length, goP, pct(goPct),
        ]);
      }

      // --- Reasons Missing tab (Player | Reason | Count)
      const reasonCounts = new Map<string, Map<string, number>>();
      for (const a of attendance) {
        const status = (a.status ?? "").toLowerCase();
        if (status !== "absent") continue;

        const pid = a.playerId;
        const reason = (a.reason ?? "").trim() || "No reason";
        if (!pid) continue;

        if (!reasonCounts.has(pid)) reasonCounts.set(pid, new Map());
        const m = reasonCounts.get(pid)!;
        m.set(reason, (m.get(reason) ?? 0) + 1);
      }

      const reasonAoa: any[][] = [["Player", "Reason", "Count"]];
      for (const p of players) {
        const m = reasonCounts.get(p.id);
        if (!m) continue;
        for (const [reason, count] of m.entries()) {
          reasonAoa.push([p.name ?? "", reason, count]);
        }
      }

      // --- Build Attendance Matrix sheet (styled) ---
      const aoa: any[][] = [];
      aoa.push(eventTypeRow);
      aoa.push(dateRow);
      aoa.push(venueRow);
      aoa.push(oppRow);
      aoa.push(scoreRow);
      aoa.push([]); // spacer

      const matrixHeaderRowIndex = aoa.length;
      aoa.push(["Player", ...ev.map(() => "")]);

      const firstPlayerRow = aoa.length;
      aoa.push(...playerRows);
      aoa.push(totalRow);
      aoa.push(pctRow);

      aoa.push([]);
      aoa.push(["Summary"]);
      aoa.push(["Total events", totalEvents]);
      aoa.push(["Overall avg attendance", pct(overallAvg)]);
      aoa.push([]);
      aoa.push(["Type", "# Events", "Avg attendance"]);

      (["training", "league_match", "championship_match", "challenge_match", "go_games"] as const).forEach((t) => {
        const avg = slotsByType[t] ? presentTotalsByType[t] / slotsByType[t] : NaN;
        aoa.push([typeLabel(t), buckets[t], pct(avg)]);
      });

      aoa.push([]);
      aoa.push(["Per player attendance split"]);
      aoa.push(["Player", "Training events", "Training present", "Training %", "Match events", "Match present", "Match %", "Go Games", "Go present", "Go %"]);
      aoa.push(...perPlayerSplitRows);

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Column widths
      ws["!cols"] = [
        { wch: 26 },
        ...ev.map(() => ({ wch: 16 })),
      ];

      // Style top meta rows (0-4): shade by event type per column
      const metaRows = [0, 1, 2, 3, 4];
      for (let c = 1; c <= ev.length; c++) {
        const fill = eventFillRGB(ev[c - 1].type);
        for (const r of metaRows) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (ws[addr]) ws[addr].s = styleHeader(fill);
        }
      }
      // Meta row labels in column A
      for (let r = 0; r <= 4; r++) {
        const addr = XLSX.utils.encode_cell({ r, c: 0 });
        if (ws[addr]) {
          ws[addr].s = {
            font: { bold: true, color: { rgb: "111827" } },
            alignment: { vertical: "center" },
          };
        }
      }

      // Matrix header styling
      for (let c = 0; c <= ev.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: matrixHeaderRowIndex, c });
        if (ws[addr]) {
          ws[addr].s = {
            font: { bold: true, color: { rgb: "111827" } },
            fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
            alignment: { vertical: "center" },
            border: { bottom: { style: "thin", color: { rgb: "E5E7EB" } } },
          };
        }
      }

      // Player matrix body styling + event column shading
      const lastPlayerRow = firstPlayerRow + players.length - 1;
      const lastMatrixRow = lastPlayerRow + 2; // includes Total + % rows

      for (let r = firstPlayerRow; r <= lastMatrixRow; r++) {
        for (let c = 0; c <= ev.length; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!ws[addr]) continue;
          ws[addr].s = styleBody();
        }
      }

      // Shade event columns (including totals rows) to match type
      for (let c = 1; c <= ev.length; c++) {
        const fill = eventFillRGB(ev[c - 1].type);
        for (let r = matrixHeaderRowIndex; r <= lastMatrixRow; r++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!ws[addr]) continue;
          ws[addr].s = {
            ...(ws[addr].s || {}),
            fill: { patternType: "solid", fgColor: { rgb: fill } },
          };
        }
      }

      // Reasons sheet
      const ws2 = XLSX.utils.aoa_to_sheet(reasonAoa);
      ws2["!cols"] = [{ wch: 26 }, { wch: 22 }, { wch: 10 }];

      // Workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance Matrix");
      XLSX.utils.book_append_sheet(wb, ws2, "Reasons Missing");

      const fname = `attendance_${teamId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fname);

      setMsg("Exported Excel with match details + shading + summaries.");
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? String(e));
    }
  }

  if (loading) {
    return (
      <AppShell title="Admin" showTopNav={false}>
        <div className="py-10 text-sm text-neutral-600">Loading…</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Admin" showTopNav={true}>
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Admin</h1>
            <div className="mt-1 text-xs text-neutral-500">
              UID: <span className="font-mono">{uid}</span>
            </div>
          </div>

          <Link
            href="/teams"
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50"
          >
            ← Teams
          </Link>
        </div>

        {msg && <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</div>}
        {err && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}

        <div className="mt-4">
          <label className="block text-sm font-medium text-neutral-800">Team</label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900/10"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={exportExcel}
              className="rounded-full bg-[#1E3A8A] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              Export Excel (.xlsx)
            </button>

            <div className="text-xs text-neutral-500">
              Exports 2 tabs: Attendance Matrix + Reasons Missing
            </div>
          </div>

          <div className="mt-3 text-xs text-neutral-500">
            Events: <strong className="text-neutral-800">{stats.events}</strong> • Players:{" "}
            <strong className="text-neutral-800">{stats.players}</strong> • Attendance records:{" "}
            <strong className="text-neutral-800">{stats.attendance}</strong>
          </div>

          <div className="mt-2 text-xs text-neutral-500">
            Tip: Column shading is based on event type (Training / League / Championship / Challenge / Go Games).
          </div>
        </div>
      </div>
    </AppShell>
  );
}
