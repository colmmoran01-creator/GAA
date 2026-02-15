"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "../../../components/AppShell";

type EventType =
  | "training"
  | "league_match"
  | "championship_match"
  | "challenge_match"
  | "go_games";

function labelForType(t: EventType) {
  switch (t) {
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
  const [venue, setVenue] = useState("");

  const isTraining = type === "training";
  const isGoGames = type === "go_games";
  const needsScore = type === "league_match" || type === "championship_match" || type === "challenge_match";
  const needsOpposition = needsScore; // Go Games does NOT require it

  const [opposition, setOpposition] = useState("");

  const [teamGoals, setTeamGoals] = useState(0);
  const [teamPoints, setTeamPoints] = useState(0);
  const [oppGoals, setOppGoals] = useState(0);
  const [oppPoints, setOppPoints] = useState(0);

  async function create() {
    if (!teamId) return alert("Missing teamId. Go back to /teams and open a team.");
    if (!venue.trim()) return alert("Venue is required.");

    if (needsOpposition && !opposition.trim()) {
      return alert("Opposition is required for League/Championship/Challenge matches.");
    }

    const payload: any = {
      teamId,
      type,
      typeLabel: labelForType(type),
      date,
      venue: venue.trim(),
      createdAt: Date.now(),
    };

    // Opposition:
    // - required for League/Champ/Challenge
    // - optional for Go Games
    // - not used for Training
    if (!isTraining && opposition.trim()) {
      payload.opposition = opposition.trim();
    }

    // Score:
    // - only for League/Champ/Challenge
    if (needsScore) {
      const teamTotal = teamGoals * 3 + teamPoints;
      const oppTotal = oppGoals * 3 + oppPoints;

      payload.teamGoals = teamGoals;
      payload.teamPoints = teamPoints;
      payload.oppGoals = oppGoals;
      payload.oppPoints = oppPoints;
      payload.result = calcResult(teamTotal, oppTotal);
    }

    const docRef = await addDoc(collection(db, "events"), payload);
    router.push(`/event/${docRef.id}`);
  }

  return (
    <AppShell title="New Event">
      <div className="mx-auto max-w-xl rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">New Event</h1>

        <div className="mt-4 grid gap-3">
          <div>
            <label className="block text-sm font-medium text-neutral-800">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EventType)}
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900/10"
            >
              <option value="training">Training</option>
              <option value="league_match">League Match</option>
              <option value="championship_match">Championship Match</option>
              <option value="challenge_match">Challenge Match</option>
              <option value="go_games">Go Games</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-800">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900/10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-800">Venue</label>
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Maryland, Tang, or Other…"
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900/10"
            />
          </div>

          {/* Opposition: show for Go Games and Matches, hide for Training */}
          {!isTraining && (
            <div>
              <label className="block text-sm font-medium text-neutral-800">
                Opposition {needsOpposition ? <span className="text-red-600">*</span> : <span className="text-neutral-500">(optional)</span>}
              </label>
              <input
                value={opposition}
                onChange={(e) => setOpposition(e.target.value)}
                placeholder={isGoGames ? "Optional (e.g., Caulry)" : "Required (e.g., Caulry)"}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
              {isGoGames && (
                <div className="mt-1 text-xs text-neutral-500">
                  Go Games: score is not captured.
                </div>
              )}
            </div>
          )}

          {/* Score: ONLY for League/Champ/Challenge */}
          {needsScore && (
            <div className="mt-1 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="text-sm font-semibold text-neutral-900">Score</div>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-neutral-200 bg-white p-3">
                  <div className="text-sm font-semibold text-neutral-900">Our team</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={0}
                      value={teamGoals}
                      onChange={(e) => setTeamGoals(parseInt(e.target.value || "0", 10))}
                      className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 outline-none"
                      placeholder="Goals"
                    />
                    <input
                      type="number"
                      min={0}
                      value={teamPoints}
                      onChange={(e) => setTeamPoints(parseInt(e.target.value || "0", 10))}
                      className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 outline-none"
                      placeholder="Points"
                    />
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">Goals • Points</div>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white p-3">
                  <div className="text-sm font-semibold text-neutral-900">Opposition</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={0}
                      value={oppGoals}
                      onChange={(e) => setOppGoals(parseInt(e.target.value || "0", 10))}
                      className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 outline-none"
                      placeholder="Goals"
                    />
                    <input
                      type="number"
                      min={0}
                      value={oppPoints}
                      onChange={(e) => setOppPoints(parseInt(e.target.value || "0", 10))}
                      className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 outline-none"
                      placeholder="Points"
                    />
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">Goals • Points</div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={create}
            className="mt-2 rounded-full bg-[#1E3A8A] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            Create & Take Attendance
          </button>

          <div className="text-xs text-neutral-500">
            {isGoGames
              ? "Go Games: no score captured. You can still track attendance."
              : "Tip: Create the event now and fill attendance on the next screen."}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
