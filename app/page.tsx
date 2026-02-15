"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "./components/AppShell";

type Team = { id: string; name: string };

export default function HomePage() {
  const router = useRouter();

  const [uid, setUid] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const auth = getAuth();

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setUid(user.uid);
      setLoadingTeams(true);
      setError("");

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
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? String(e));
      } finally {
        setLoadingTeams(false);
      }
    });

    return () => unsub();
  }, [router]);

  return (
    <AppShell title="Club Hub" showTopNav={true}>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Sidebar */}
        <aside className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-4 py-3">
            <div className="text-sm font-semibold text-neutral-900">Teams</div>
            <div className="mt-1 text-xs text-neutral-500">
              Quick access for your UID: <span className="font-mono">{uid}</span>
            </div>
          </div>

          <div className="p-2">
            {loadingTeams && <div className="px-2 py-3 text-sm text-neutral-600">Loading teams…</div>}
            {error && <div className="px-2 py-3 text-sm text-red-700">{error}</div>}
            {!loadingTeams && !error && teams.length === 0 && (
              <div className="px-2 py-3 text-sm text-neutral-600">No teams assigned to your account.</div>
            )}

            <div className="grid gap-2">
              {teams.map((t) => (
                <Link
                  key={t.id}
                  href={`/team/${t.id}`}
                  className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm transition hover:bg-neutral-50"
                >
                  <div className="text-sm font-semibold text-neutral-900">{t.name}</div>
                  <div className="mt-1 text-xs text-neutral-500">Tap to open</div>
                </Link>
              ))}
            </div>

            <div className="mt-3 px-1">
              <Link
                href="/teams"
                className="inline-flex items-center justify-center rounded-full bg-[#1E3A8A] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
              >
                View full Teams page
              </Link>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <section className="grid gap-4">
          {/* Club Ethos */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-neutral-900">Club Ethos</div>
            <div className="mt-2 text-sm text-neutral-800">
              Give Respect, Get Respect. We coach in a positive, safe environment where every player develops skills,
              confidence, and love for the game. Selection is fair, transparent, and always player-first.
            </div>
          </div>

          {/* 3 Tier Selection Headings */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-neutral-900">The 3 Tier Selection Headings</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-neutral-800">
              <li>
                <strong>Attendance (50%):</strong> Consistent participation in training sessions and team activities is crucial for both individual growth, retention and parish senior team success.
              </li>
              <li>
                <strong>Age Category (30%):</strong> Age appropriateness ensures that players are placed in the correct developmental environment to maximize their growth and competitive potential.
              </li>
              <li>
                <strong>Ability (20%):</strong> Player performance and skills will be assessed to ensure they contribute positively to the team’s success.
              </li>
            </ul>
          </div>

          {/* PDF link + Contacts */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-neutral-900">Club Documents</div>
              <div className="mt-2 text-sm text-neutral-700">
                Download the club selection criteria PDF:
              </div>
              <a
                href="/Mentor Policy on Player Selection Criteria.pdf"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-[#7A0019] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
              >
                Open PDF
              </a>
              <div className="mt-2 text-xs text-neutral-500">
               
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-neutral-900">Contacts</div>
              <div className="mt-2 text-sm text-neutral-700">
                Chairman, Secretary, Treasurer, PRO, Pitch Co-ordinators.
              </div>
              <Link
                href="/contacts"
                className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-[#1E3A8A] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
              >
                Open Contacts Page
              </Link>
            </div>
          </div>

          {/* Important Notes */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-neutral-900">Important Notes</div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-sm font-semibold text-neutral-900">Pitch Rules</div>
                <ul className="mt-2 list-disc pl-5 text-sm text-neutral-800">
                  <li>All Rubbish to be collected and binned after each session.</li>
                  <li>No Goal Posts to be left on the playing fields after a session.</li>
                  <li>Leave the pitch as you found it: cones/bibs collected.</li>
                  <li>Pitch must be vacated at the alloted time.</li>
                  <li>Please be vigilant of Moving Traffic in carparks at all times - especially for younger age groups.</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-sm font-semibold text-neutral-900">Match Result Reporting</div>
                <ul className="mt-2 list-disc pl-5 text-sm text-neutral-800">
                  <li>Report match results on same day where possible to club secretary.</li>
                  <li>Use the agreed channel - WhatsApp.</li>
                  <li>Include opponent, venue, and any notes.</li>
                </ul>
              </div>
            </div>

            <div className="mt-3 text-xs text-neutral-500">
          
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
