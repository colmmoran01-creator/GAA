"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

type EventType = "training" | "match" | "challenge";

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
  const [opposition, setOpposition] = useState("");

  const [teamGoals, setTeamGoals] = useState(0);
  const [teamPoints, setTeamPoints] = useState(0);
  const [oppGoals, setOppGoals] = useState(0);
  const [oppPoints, setOppPoints] = useState(0);

  async function create() {
    if (!teamId) return alert("Missing teamId. Go back to /teams and open a team.");
    if (!venue.trim()) return alert("Venue is required.");

    const isMatch = type === "match" || type === "challenge";

    const payload: any = {
      teamId,
      type,
      date,
      venue: venue.trim(),
      createdAt: Date.now(),
    };

    if (isMatch) {
      if (!opposition.trim()) return alert("Opposition is required for match/challenge.");
      const teamTotal = teamGoals * 3 + teamPoints;
      const oppTotal = oppGoals * 3 + oppPoints;

      payload.opposition = opposition.trim();
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
    <main style={{ maxWidth: 520, margin: "24px auto", padding: 16 }}>
      <h1>New Event</h1>

      <label>Type</label>
      <select value={type} onChange={(e) => setType(e.target.value as EventType)} style={{ width: "100%", padding: 10, marginBottom: 10 }}>
        <option value="training">Training</option>
        <option value="match">Match</option>
        <option value="challenge">Challenge</option>
      </select>

      <label>Date</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 10 }} />

      <label>Venue</label>
      <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g., Tang" style={{ width: "100%", padding: 10, marginBottom: 10 }} />

      {(type === "match" || type === "challenge") && (
        <>
          <label>Opposition</label>
          <input value={opposition} onChange={(e) => setOpposition(e.target.value)} placeholder="e.g., Caulry" style={{ width: "100%", padding: 10, marginBottom: 12 }} />

          <h3>Score</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
              <strong>Our team</strong>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <input type="number" min={0} value={teamGoals} onChange={(e) => setTeamGoals(parseInt(e.target.value || "0", 10))} style={{ width: "100%", padding: 10 }} />
                <input type="number" min={0} value={teamPoints} onChange={(e) => setTeamPoints(parseInt(e.target.value || "0", 10))} style={{ width: "100%", padding: 10 }} />
              </div>
              <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>Goals • Points</div>
            </div>

            <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
              <strong>Opposition</strong>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <input type="number" min={0} value={oppGoals} onChange={(e) => setOppGoals(parseInt(e.target.value || "0", 10))} style={{ width: "100%", padding: 10 }} />
                <input type="number" min={0} value={oppPoints} onChange={(e) => setOppPoints(parseInt(e.target.value || "0", 10))} style={{ width: "100%", padding: 10 }} />
              </div>
              <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>Goals • Points</div>
            </div>
          </div>
        </>
      )}

      <button onClick={create} style={{ width: "100%", padding: 12, marginTop: 16 }}>
        Create & Take Attendance
      </button>
    </main>
  );
}
