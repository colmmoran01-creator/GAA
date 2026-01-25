"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "../../components/AppShell";

type EventType = "training" | "match" | "challenge";
type VenueType = "Maryland" | "Tang" | "Other";

const MAROON = "#7A0019";
const ROYAL = "#1E3A8A";

function calcResult(teamTotal: number, oppTotal: number): "W" | "D" | "L" {
  if (teamTotal > oppTotal) return "W";
  if (teamTotal < oppTotal) return "L";
  return "D";
}

export default function NewEventPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = typeof params.teamId === "string" ? params.teamId : "";

  const [type, setType] = useState<EventType>("training");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const [venueType, setVenueType] = useState<VenueType>("Tang");
  const [venueOther, setVenueOther] = useState("");
  const venueFinal =
    venueType === "Other" ? venueOther.trim() : venueType;

  const [opposition, setOpposition] = useState("");

  const [teamGoals, setTeamGoals] = useState(0);
  const [teamPoints, setTeamPoints] = useState(0);
  const [oppGoals, setOppGoals] = useState(0);
  const [oppPoints, setOppPoints] = useState(0);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function create() {
    setMsg("");

    if (!teamId) return setMsg("Missing teamId. Go back to Teams and reopen the team.");
    if (!date) return setMsg("Date is required.");

    if (venueType === "Other" && !venueOther.trim()) {
      return setMsg("Please enter a venue name for Other.");
    }

    const isMatch = type === "match" || type === "challenge";

    const payload: any = {
      teamId,
      type,
      date,
      venueType,
      venueOther: venueType === "Other" ? venueOther.trim() : "",
      venue: venueFinal,
      createdAt: Date.now(),
    };

    if (isMatch) {
      if (!opposition.trim()) return setMsg("Opposition is required for match/challenge.");
      const teamTotal = teamGoals * 3 + teamPoints;
      const oppTotal = oppGoals * 3 + oppPoints;

      payload.opposition = opposition.trim();
      payload.teamGoals = teamGoals;
      payload.teamPoints = teamPoints;
      payload.oppGoals = oppGoals;
      payload.oppPoints = oppPoints;
      payload.result = calcResult(teamTotal, oppTotal);
    }

    try {
      setSaving(true);
      const docRef = await addDoc(collection(db, "events"), payload);
      router.push(`/event/${docRef.id}`);
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="New Event">
      <div className="mb-4">
        <Link
          href={`/team/${teamId}`}
          className="text-sm font-semibold underline-offset-4 hover:underline"
        >
          ← Back to Team
        </Link>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Create Event</h1>
            <div className="mt-1 text-sm text-neutral-600">
              Training, match or challenge — then take attendance.
            </div>
          </div>

          <span
            className="rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: ROYAL }}
          >
            Team
          </span>
        </div>

        <div className="mt-5 grid gap-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EventType)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
            >
              <option value="training">Training</option>
              <option value="match">Match</option>
              <option value="challenge">Challenge</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Venue</label>
            <select
              value={venueType}
              onChange={(e) => setVenueType(e.target.value as VenueType)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
            >
              <option value="Maryland">Maryland</option>
              <option value="Tang">Tang</option>
              <option value="Other">Other</option>
            </select>

            {venueType === "Other" && (
              <input
                value={venueOther}
                onChange={(e) => setVenueOther(e.target.value)}
                placeholder="Enter venue name…"
                className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
              />
            )}
          </div>

          {(type === "match" || type === "challenge") && (
            <>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Opposition</label>
                <input
                  value={opposition}
                  onChange={(e) => setOpposition(e.target.value)}
                  placeholder="e.g., Caulry"
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
                />
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-sm font-semibold mb-3">Score (Goals • Points)</div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                    <div className="text-sm font-semibold">Our team</div>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="number"
                        min={0}
                        value={teamGoals}
                        onChange={(e) => setTeamGoals(parseInt(e.target.value || "0", 10))}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
                      />
                      <input
                        type="number"
                        min={0}
                        value={teamPoints}
                        onChange={(e) => setTeamPoints(parseInt(e.target.value || "0", 10))}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
                      />
                    </div>
                    <div className="mt-2 text-xs text-neutral-500">Goals • Points</div>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                    <div className="text-sm font-semibold">Opposition</div>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="number"
                        min={0}
                        value={oppGoals}
                        onChange={(e) => setOppGoals(parseInt(e.target.value || "0", 10))}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
                      />
                      <input
                        type="number"
                        min={0}
                        value={oppPoints}
                        onChange={(e) => setOppPoints(parseInt(e.target.value || "0", 10))}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
                      />
                    </div>
                    <div className="mt-2 text-xs text-neutral-500">Goals • Points</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {msg && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {msg}
            </div>
          )}

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Link
              href={`/team/${teamId}`}
              className="rounded-xl bg-neutral-100 px-4 py-2.5 text-center text-sm font-semibold text-neutral-900 hover:bg-neutral-200"
            >
              Cancel
            </Link>

            <button
              onClick={create}
              disabled={saving}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: MAROON }}
            >
              {saving ? "Creating…" : "Create & Take Attendance"}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

