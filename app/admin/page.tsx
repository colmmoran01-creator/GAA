"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "../components/AppShell";
import * as XLSX from "xlsx-js-style";

type Team = { id: string; name: string; coachNames?: string[]; coachUids?: string[]; adminUids?: string[] };
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

  attendanceTakenByUid?: string;
  attendanceTakenByName?: string;
  attendanceTakenAt?: number;

  // optional summary fields if you write them on saveAttendance()
  attendanceTotal?: number;
  attendancePresent?: number;
  attendanceAbsent?: number;
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

function normalizeType(t: any): CanonType {
  if (t === "match") return "league_match";
  if (t === "challenge") return "challenge_match";
  if (
    t === "training" ||
    t === "league_match" ||
    t === "championship_match" ||
    t === "challenge_match" ||
    t === "go_games"
  )
    return t;
  return "training";
}

function typeLabel(t: any) {
  switch (normalizeType(t)) {
    case "training":
      return "Training";
    case "league_match":
      return "League Match";
    case "championship_match":
      return "Championship Match";
    case "challenge_match":
      return "Challenge Match";
    case "go_games":
      return "Go Games";
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
  const nt = normalizeType(t);
  switch (nt) {
    case "training":
      return "D9EAFD"; // light blue
    case "league_match":
      return "DDF7E3"; // light green
    case "championship_match":
      return "FFF2CC"; // light gold
    case "challenge_match":
      return "FADBD8"; // light red
    case "go_games":
      return "EFE1FF"; // light purple
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

async function fetchUserDisplayName(uid: string): Promise<string> {
  if (!uid) return "";
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return "";

  const data = snap.data() as any;
  const display = String(data.displayName ?? "").trim();
  const first = String(data.firstName ?? "").trim();
  const last = String(data.lastName ?? "").trim();
  return display || `${first} ${last}`.trim();
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
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Auth + load teams user can see (admin OR coach)
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
        const qAdmin = query(collection(db, "teams"), where("adminUids", "array-contains", user.uid));
        const qCoach = query(collection(db, "teams"), where("coachUids", "array-contains", user.uid));

        const [snapAdmin, snapCoach] = await Promise.all([getDocs(qAdmin), getDocs(qCoach)]);

        const map = new Map<string, Team>();
        snapAdmin.forEach((d) => {
          const data = d.data() as any;
          map.set(d.id, { id: d.id, name: data?.name ?? d.id, ...(data as any) });
        });
        snapCoach.forEach((d) => {
          const data = d.data() as any;
          map.set(d.id, { id: d.id, name: data?.name ?? d.id, ...(data as any) });
        });

        const list = Array.from(map.values()).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
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

  // Load events/players/attendance for selected team
  useEffect(() => {
    (async () => {
      if (!teamId) return;

      setLoading(true);
      setErr("");
      setMsg("");

      try {
        const qEvents = query(collection(db, "events"), where("teamId", "==", teamId), orderBy("date", "asc"));
        const snapE = await getDocs(qEvents);
        const ev: EventDoc[] = [];
        snapE.forEach((d) => ev.push({ id: d.id, ...(d.data() as any) }));
        setEvents(ev);

        const qPlayers = query(collection(db, "players"), where("teamId", "==", teamId));
        const snapP = await getDocs(qPlayers);
        const pl: Player[] = [];
        snapP.forEach((d) => pl.push({ id: d.id, ...(d.data() as any) }));
        pl.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
        setPlayers(pl);

        // attendance records for team
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

  async function exportExcel() {
    setExporting(true);
    try {
      setErr("");
      setMsg("");
      if (!teamId) return;

      const ev = [...events].sort((a, b) => String(a.date).localeCompare(String(b.date)));

      // Map attendance: attMap[eventId][playerId] = present boolean
      const attMap = new Map<string, Map<string, boolean>>();
      for (const a of attendance) {
        if (!a.eventId || !a.playerId) continue;
        const present = (a.status ?? "").toLowerCase() === "present" || a.present === true;
        if (!attMap.has(a.eventId)) attMap.set(a.eventId, new Map());
        attMap.get(a.eventId)!.set(a.playerId, present);
      }

      // Coach names (users fallback)
      const userNameCache = new Map<string, string>();
      async function resolveCoachName(e: EventDoc): Promise<string> {
        const direct = String(e.attendanceTakenByName ?? "").trim();
        if (direct) return direct;

        const byUid = String(e.attendanceTakenByUid ?? "").trim();
        if (!byUid) return "";

        if (userNameCache.has(byUid)) return userNameCache.get(byUid)!;

        const name = await fetchUserDisplayName(byUid);
        const finalName = name || byUid;
        userNameCache.set(byUid, finalName);
        return finalName;
      }
      const coachNames = await Promise.all(ev.map(resolveCoachName));

      // ✅ Attendance saved flag per event
      const savedFlags = ev.map((e) => !!e.attendanceTakenAt);

      // meta rows per event column
      const eventTypeRow = ["Event type", ...ev.map((e) => typeLabel(e.type))];
      const dateRow = ["Date", ...ev.map((e) => e.date ?? "")];
      const venueRow = ["Venue", ...ev.map((e) => e.venue ?? "")];
      const coachRow = ["Coach", ...coachNames];
      const oppRow = ["Opposition", ...ev.map((e) => e.opposition ?? "")];
      const scoreRow = ["Score", ...ev.map((e) => (isMatchType(e.type) && !isGoGames(e.type) ? scoreString(e) : ""))];

      // matrix rows
      const playerRows: (string | number)[][] = [];

      // ✅ presentCounts: null means "Not taken"
      const presentCounts: (number | null)[] = new Array(ev.length).fill(null);

      // initialise counts for saved events only
      ev.forEach((e, idx) => {
        if (savedFlags[idx]) presentCounts[idx] = 0;
      });

      for (const p of players) {
        const row: (string | number)[] = [p.name ?? ""];
        ev.forEach((e, idx) => {
          if (!savedFlags[idx]) {
            // ✅ Not saved: show blank marker instead of "No"
            row.push("—");
            return;
          }

          const present = attMap.get(e.id)?.get(p.id) === true;
          if (present) presentCounts[idx] = (presentCounts[idx] ?? 0) + 1;
          row.push(present ? "Yes" : "No");
        });
        playerRows.push(row);
      }

      // totals and % rows (blank for not saved)
      const totalRow: (string | number)[] = ["Total present", ...presentCounts.map((x) => (x === null ? "" : x))];
      const pctRow: (string | number)[] = [
        "% attendance",
        ...presentCounts.map((c, idx) => {
          if (!savedFlags[idx]) return "";
          if (!players.length) return "";
          return pct((c ?? 0) / players.length);
        }),
      ];

      // summary block (ignore events where attendance not saved)
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

        if (!savedFlags[idx]) return; // ✅ ignore unsaved events in attendance averages
        presentTotalsByType[t] += (presentCounts[idx] ?? 0);
        slotsByType[t] += players.length;
      });

      const totalEvents = ev.length;

      // overall avg only counts saved events
      const totalPresent = presentCounts.reduce<number>((acc, v) => acc + (v ?? 0), 0);
      const totalSavedEvents = savedFlags.filter(Boolean).length;
      const totalSlots = totalSavedEvents * players.length;
      const overallAvg = totalSlots ? totalPresent / totalSlots : 0;

      // per-player split: only count saved events
      const trainingIds = ev
        .filter((e, idx) => normalizeType(e.type) === "training" && savedFlags[idx])
        .map((e) => e.id);
      const matchIds = ev
        .filter((e, idx) => isMatchType(e.type) && savedFlags[idx])
        .map((e) => e.id);
      const goIds = ev
        .filter((e, idx) => normalizeType(e.type) === "go_games" && savedFlags[idx])
        .map((e) => e.id);

      const perPlayerSplitRows: (string | number)[][] = [];
      for (const p of players) {
        const countPresent = (ids: string[]) =>
          ids.reduce((acc, id) => acc + (attMap.get(id)?.get(p.id) === true ? 1 : 0), 0);

        const trP = countPresent(trainingIds);
        const maP = countPresent(matchIds);
        const goP = countPresent(goIds);

        const trPct = trainingIds.length ? trP / trainingIds.length : NaN;
        const maPct = matchIds.length ? maP / matchIds.length : NaN;
        const goPct = goIds.length ? goP / goIds.length : NaN;

        perPlayerSplitRows.push([
          p.name ?? "",
          trainingIds.length,
          trP,
          pct(trPct),
          matchIds.length,
          maP,
          pct(maPct),
          goIds.length,
          goP,
          pct(goPct),
        ]);
      }

      // Reasons Missing tab (Player | Reason | Count)
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

      // Build Attendance Matrix sheet
      const aoa: any[][] = [];
      aoa.push(eventTypeRow); // row 0
      aoa.push(dateRow);      // row 1
      aoa.push(venueRow);     // row 2
      aoa.push(coachRow);     // row 3
      aoa.push(oppRow);       // row 4
      aoa.push(scoreRow);     // row 5
      aoa.push([]);           // spacer

      const matrixHeaderRowIndex = aoa.length;
      aoa.push(["Player", ...ev.map((e, idx) => (savedFlags[idx] ? "" : "NOT TAKEN"))]);

      const firstPlayerRow = aoa.length;
      aoa.push(...playerRows);
      const lastPlayerRow = firstPlayerRow + players.length - 1;

      aoa.push(totalRow);
      aoa.push(pctRow);

      aoa.push([]);
      aoa.push(["Summary"]);
      aoa.push(["Total events", totalEvents]);
      aoa.push(["Events with attendance saved", totalSavedEvents]);
      aoa.push(["Overall avg attendance (saved events only)", totalSavedEvents ? pct(overallAvg) : ""]);
      aoa.push([]);
      aoa.push(["Type", "# Events", "Avg attendance (saved only)"]);

      (["training", "league_match", "championship_match", "challenge_match", "go_games"] as const).forEach((t) => {
        const avg = slotsByType[t] ? presentTotalsByType[t] / slotsByType[t] : NaN;
        aoa.push([typeLabel(t), buckets[t], pct(avg)]);
      });

      aoa.push([]);
      aoa.push(["Per player attendance split (saved events only)"]);
      aoa.push([
        "Player",
        "Training events",
        "Training present",
        "Training %",
        "Match events",
        "Match present",
        "Match %",
        "Go Games",
        "Go present",
        "Go %",
      ]);
      aoa.push(...perPlayerSplitRows);

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Column widths
      ws["!cols"] = [{ wch: 26 }, ...ev.map(() => ({ wch: 18 }))];

      // Style meta rows (0..5)
      const metaRows = [0, 1, 2, 3, 4, 5];
      for (let c = 1; c <= ev.length; c++) {
        const fill = eventFillRGB(ev[c - 1].type);
        for (const r of metaRows) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (ws[addr]) ws[addr].s = styleHeader(fill);
        }
      }

      // Label cells in column A for meta rows
      for (let r = 0; r <= 5; r++) {
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
            alignment: { vertical: "center", wrapText: true },
            border: {
              bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            },
          };
        }
      }

      const lastMatrixRow = lastPlayerRow + 2; // Total + % rows

      // Body styling
      for (let r = firstPlayerRow; r <= lastMatrixRow; r++) {
        for (let c = 0; c <= ev.length; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!ws[addr]) continue;
          ws[addr].s = styleBody();
        }
      }

      // Shade event columns in matrix area to match type
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

      const teamName = teams.find((t) => t.id === teamId)?.name ?? teamId;
      const fname = `attendance_${teamName}_${new Date().toISOString().slice(0, 10)}.xlsx`;

      XLSX.writeFile(wb, fname);
      setMsg("Exported Excel ✅ (Unsaved events show NOT TAKEN, do not count as 0)");
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? String(e));
    } finally {
      setExporting(false);
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

        {msg && (
          <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            {msg}
          </div>
        )}
        {err && (
          <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}

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
              disabled={exporting}
              className="rounded-full bg-[#1E3A8A] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {exporting ? "Exporting…" : "Export Excel (.xlsx)"}
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
            Export logic: if <code>events.attendanceTakenAt</code> is missing, that event column shows{" "}
            <strong>NOT TAKEN</strong> and does not count as 0% attendance.
          </div>
        </div>
      </div>
    </AppShell>
  );
}