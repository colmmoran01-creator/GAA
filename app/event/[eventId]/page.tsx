"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "../../components/AppShell";

type Player = { id: string; name: string };

type EventDoc = {
  id: string;
  teamId: string;
  type: string;
  date: string;
  venue?: string;
  opposition?: string;

  teamGoals?: number;
  teamPoints?: number;
  oppGoals?: number;
  oppPoints?: number;

  attendanceTakenByUid?: string;
  attendanceTakenByName?: string;
  attendanceTakenAt?: number;

  // ✅ NEW: attendance summary saved on event for exports
  attendanceTotal?: number;
  attendancePresent?: number;
  attendanceAbsent?: number;
};

type AttendanceRow = {
  playerId: string;
  status: "Present" | "Absent";
  reason: string;
};

const ABSENCE_REASONS = ["", "Rugby", "Soccer", "Hurling", "Holidays", "Work", "No Apology"];

// Venue dropdown options
const VENUE_OPTIONS = ["Maryland", "Tang", "Other"] as const;
type VenueOption = (typeof VENUE_OPTIONS)[number];

type CanonType = "training" | "league_match" | "championship_match" | "challenge_match" | "go_games";

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

function isMatchType(t: any) {
  const nt = normalizeType(t);
  return nt === "league_match" || nt === "championship_match" || nt === "challenge_match";
}

function isGoGames(t: any) {
  return normalizeType(t) === "go_games";
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

function scoreString(e: EventDoc) {
  if (
    e.teamGoals === undefined ||
    e.teamPoints === undefined ||
    e.oppGoals === undefined ||
    e.oppPoints === undefined
  )
    return "";
  return `${e.teamGoals}-${e.teamPoints} vs ${e.oppGoals}-${e.oppPoints}`;
}

async function getCurrentUserDisplayName(): Promise<{ uid: string; name: string }> {
  const auth = getAuth();
  const u = auth.currentUser;
  if (!u) throw new Error("Not logged in.");

  const snap = await getDoc(doc(db, "users", u.uid));
  if (snap.exists()) {
    const data = snap.data() as any;
    const first = String(data.firstName ?? "").trim();
    const last = String(data.lastName ?? "").trim();
    const display = String(data.displayName ?? "").trim();

    const name = display || `${first} ${last}`.trim() || u.displayName || u.email || u.uid;
    return { uid: u.uid, name };
  }

  return { uid: u.uid, name: u.displayName || u.email || u.uid };
}

export default function EventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = typeof params.eventId === "string" ? params.eventId : "";

  // Core state
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rows, setRows] = useState<Record<string, AttendanceRow>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Venue state
  const [venueChoice, setVenueChoice] = useState<VenueOption>("Maryland");
  const [venueOtherText, setVenueOtherText] = useState("");
  const [venueSaving, setVenueSaving] = useState(false);

  // Unsaved-change protection
  const [dirty, setDirty] = useState(false);
  const [initialised, setInitialised] = useState(false);

  function confirmLeaveIfDirty() {
    if (!dirty) return true;
    return window.confirm("You have unsaved attendance changes. Leave this page without saving?");
  }

  // Warn on tab close / refresh
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  // Warn on browser back/forward (SPA)
  useEffect(() => {
    // create a history entry so back triggers popstate
    try {
      history.pushState(null, "", window.location.href);
    } catch {}

    function onPopState() {
      if (!dirty) return;
      const ok = window.confirm("You have unsaved attendance changes. Leave this page without saving?");
      if (!ok) {
        try {
          history.pushState(null, "", window.location.href);
        } catch {}
      }
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [dirty]);

  // Auth gate
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) router.replace("/login");
    });
    return () => unsub();
  }, [router]);

  // Load event + players + attendance
  useEffect(() => {
    (async () => {
      if (!eventId) return;

      setLoading(true);
      setErr("");
      setMsg("");
      setDirty(false);
      setInitialised(false);

      try {
        // 1) Event
        const eSnap = await getDoc(doc(db, "events", eventId));
        if (!eSnap.exists()) {
          setErr("Event not found.");
          setLoading(false);
          return;
        }
        const eData = { id: eSnap.id, ...(eSnap.data() as any) } as EventDoc;
        setEvent(eData);

        // Init venue UI from event.venue
        const currentVenue = String(eData.venue ?? "").trim();
        if (!currentVenue) {
          setVenueChoice("Maryland");
          setVenueOtherText("");
        } else if (currentVenue.toLowerCase() === "maryland") {
          setVenueChoice("Maryland");
          setVenueOtherText("");
        } else if (currentVenue.toLowerCase() === "tang") {
          setVenueChoice("Tang");
          setVenueOtherText("");
        } else {
          setVenueChoice("Other");
          setVenueOtherText(currentVenue);
        }

        // 2) Players
        const pQ = query(collection(db, "players"), where("teamId", "==", eData.teamId));
        const pSnap = await getDocs(pQ);

        const pList: Player[] = [];
        pSnap.forEach((d) => pList.push({ id: d.id, ...(d.data() as any) }));
        pList.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
        setPlayers(pList);

        // 3) Attendance (scoped query)
        try {
          const aQ = query(
            collection(db, "attendance"),
            where("teamId", "==", eData.teamId),
            where("eventId", "==", eventId)
          );
          const aSnap = await getDocs(aQ);

          const map: Record<string, AttendanceRow> = {};
          aSnap.forEach((d) => {
            const a = d.data() as any;
            if (!a.playerId) return;

            const statusRaw = String(a.status ?? "").toLowerCase();
            const status: "Present" | "Absent" =
              statusRaw === "present" || a.present === true ? "Present" : "Absent";

            map[a.playerId] = {
              playerId: a.playerId,
              status,
              reason: String(a.reason ?? ""),
            };
          });

          // default any missing player to Present in UI
          for (const p of pList) {
            if (!map[p.id]) map[p.id] = { playerId: p.id, status: "Present", reason: "" };
          }

          setRows(map);
        } catch (e: any) {
          console.error("Attendance preload failed (non-fatal):", e);
          const map: Record<string, AttendanceRow> = {};
          for (const p of pList) map[p.id] = { playerId: p.id, status: "Present", reason: "" };
          setRows(map);
        }

        setDirty(false);
        setInitialised(true);
      } catch (e: any) {
        console.error(e);
        setErr(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  const presentCount = useMemo(() => {
    return Object.values(rows).filter((r) => r.status === "Present").length;
  }, [rows]);

  // Save venue
  async function saveVenue() {
    if (!event) return;

    setVenueSaving(true);
    setErr("");
    setMsg("");

    try {
      const finalVenue = venueChoice === "Other" ? venueOtherText.trim() : venueChoice;

      await updateDoc(doc(db, "events", eventId), {
        venue: finalVenue || "",
      });

      setEvent((prev) => (prev ? { ...prev, venue: finalVenue } : prev));
      setMsg("Venue saved ✅");
      setDirty(false);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? String(e));
    } finally {
      setVenueSaving(false);
    }
  }

  // Save attendance
  async function saveAttendance() {
    if (!event) return;

    setSaving(true);
    setErr("");
    setMsg("");

    try {
      const { uid, name } = await getCurrentUserDisplayName();
      const batch = writeBatch(db);

      for (const p of players) {
        const r = rows[p.id] ?? ({ playerId: p.id, status: "Present", reason: "" } as AttendanceRow);
        const docId = `${eventId}_${p.id}`;

        batch.set(
          doc(db, "attendance", docId),
          {
            teamId: event.teamId,
            eventId,
            playerId: p.id,
            playerName: p.name ?? "",
            status: r.status,
            reason: r.status === "Absent" ? (r.reason ?? "") : "",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      await batch.commit();

      // ✅ summary counts saved to event for exports
      const total = players.length;
      const present = Object.values(rows).filter((r) => r.status === "Present").length;
      const absent = total - present;

      await updateDoc(doc(db, "events", eventId), {
        attendanceTakenByUid: uid,
        attendanceTakenByName: name,
        attendanceTakenAt: Date.now(),
        attendanceTotal: total,
        attendancePresent: present,
        attendanceAbsent: absent,
      });

      setEvent((prev) =>
        prev
          ? {
              ...prev,
              attendanceTakenByUid: uid,
              attendanceTakenByName: name,
              attendanceTakenAt: Date.now(),
              attendanceTotal: total,
              attendancePresent: present,
              attendanceAbsent: absent,
            }
          : prev
      );

      setMsg(`Attendance saved ✅ (Recorded by ${name})`);
      setDirty(false);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell title="Event" showTopNav={true}>
        <div className="py-10 text-sm text-neutral-600">Loading…</div>
      </AppShell>
    );
  }

  if (!event) {
    return (
      <AppShell title="Event" showTopNav={true}>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-red-700">{err || "Event not found."}</div>
          <div className="mt-3">
            <Link className="text-sm underline" href="/teams">
              ← Back to Teams
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const attendanceSaved = !!event.attendanceTakenAt;

  return (
    <AppShell title="Attendance" showTopNav={true}>
      <div className="grid gap-4">
        {/* Event summary */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-neutral-900">
                {typeLabel(event.type)} • {event.date}
              </div>

              {/* Warning if not saved */}
              {!attendanceSaved && (
                <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  Attendance not saved yet. Please click <strong>Save Attendance</strong> before leaving.
                </div>
              )}

              {/* Warning if dirty */}
              {dirty && (
                <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  You have unsaved changes. Don’t forget to click <strong>Save Attendance</strong>.
                </div>
              )}

              {/* Venue */}
              <div className="mt-2">
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700">Venue</label>
                    <select
                      value={venueChoice}
                      onChange={(e) => {
                        const v = e.target.value as VenueOption;
                        setVenueChoice(v);
                        if (v !== "Other") setVenueOtherText("");
                        if (initialised) setDirty(true);
                      }}
                      className="mt-1 rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900/10"
                    >
                      {VENUE_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  {venueChoice === "Other" && (
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700">Other (type venue)</label>
                      <input
                        value={venueOtherText}
                        onChange={(e) => {
                          setVenueOtherText(e.target.value);
                          if (initialised) setDirty(true);
                        }}
                        placeholder="e.g. Ballymore, Away pitch, etc."
                        className="mt-1 w-[260px] rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900/10"
                      />
                    </div>
                  )}

                  <button
                    onClick={saveVenue}
                    disabled={venueSaving || (venueChoice === "Other" && venueOtherText.trim().length === 0)}
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50 disabled:opacity-50"
                  >
                    {venueSaving ? "Saving…" : "Save Venue"}
                  </button>

                  {isMatchType(event.type) && (
                    <div className="text-sm text-neutral-700">
                      Opposition: <strong>{event.opposition || "—"}</strong>
                    </div>
                  )}
                </div>

                <div className="mt-1 text-sm text-neutral-700">
                  Stored Venue: <strong>{event.venue || "—"}</strong>
                </div>
              </div>

              {isMatchType(event.type) && !isGoGames(event.type) && (
                <div className="mt-1 text-sm text-neutral-700">
                  Score: <strong>{scoreString(event) || "—"}</strong>
                </div>
              )}

              <div className="mt-2 text-xs text-neutral-500">
                Present: <strong className="text-neutral-800">{presentCount}</strong> /{" "}
                <strong className="text-neutral-800">{players.length}</strong>
              </div>

              {(event.attendanceTakenByName || event.attendanceTakenByUid) && (
                <div className="mt-2 text-xs text-neutral-500">
                  Last saved by:{" "}
                  <strong className="text-neutral-800">
                    {event.attendanceTakenByName || event.attendanceTakenByUid}
                  </strong>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Link
                href={`/team/${event.teamId}`}
                onClick={(e) => {
                  if (!confirmLeaveIfDirty()) e.preventDefault();
                }}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50"
              >
                ← Team
              </Link>

              <button
                onClick={saveAttendance}
                disabled={saving}
                className="rounded-full bg-[#1E3A8A] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Attendance"}
              </button>
            </div>
          </div>

          {msg && <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</div>}
          {err && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        </div>

        {/* Attendance list */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
          <div className="grid gap-2">
            {players.map((p) => {
              const r = rows[p.id] ?? ({ playerId: p.id, status: "Present", reason: "" } as AttendanceRow);
              const isAbsent = r.status === "Absent";

              return (
                <div key={p.id} className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-neutral-900">{p.name}</div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setRows((prev) => ({
                            ...prev,
                            [p.id]: { ...r, status: "Present", reason: "" },
                          }));
                          if (initialised) setDirty(true);
                        }}
                        className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition ${
                          !isAbsent
                            ? "bg-emerald-600 text-white"
                            : "bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-50"
                        }`}
                      >
                        Present
                      </button>

                      <button
                        onClick={() => {
                          setRows((prev) => ({
                            ...prev,
                            [p.id]: { ...r, status: "Absent" },
                          }));
                          if (initialised) setDirty(true);
                        }}
                        className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition ${
                          isAbsent
                            ? "bg-[#7A0019] text-white"
                            : "bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-50"
                        }`}
                      >
                        Absent
                      </button>
                    </div>
                  </div>

                  {isAbsent && (
                    <div className="mt-3">
                      <label className="block text-xs font-semibold text-neutral-700">Reason (optional)</label>
                      <select
                        value={r.reason}
                        onChange={(e) => {
                          setRows((prev) => ({
                            ...prev,
                            [p.id]: { ...r, reason: e.target.value },
                          }));
                          if (initialised) setDirty(true);
                        }}
                        className="mt-1 w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900/10 md:w-[260px]"
                      >
                        {ABSENCE_REASONS.map((x) => (
                          <option key={x} value={x}>
                            {x === "" ? "Select…" : x}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-3 mt-3 px-2">
            <button
              onClick={saveAttendance}
              disabled={saving}
              className="w-full rounded-full bg-[#1E3A8A] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Attendance"}
            </button>
          </div>
        </div>

        <div className="text-xs text-neutral-500">
          Tip: Coach name is pulled from <code>users/{`{uid}`}</code> and saved into{" "}
          <code>events.attendanceTakenByName</code> for Admin export.
        </div>
      </div>
    </AppShell>
  );
}