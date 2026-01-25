"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

const MAROON = "#7A0019";
const ROYAL = "#1E3A8A";

function Tab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex flex-1 items-center justify-center rounded-2xl px-3 py-2 text-sm font-semibold transition",
        active ? "text-white" : "text-neutral-700 hover:bg-neutral-50",
      ].join(" ")}
      style={active ? { backgroundColor: ROYAL } : undefined}
    >
      {label}
    </Link>
  );
}

export default function BottomNav() {
  const path = usePathname();
  const isTeams = path === "/teams" || path.startsWith("/team/");
  const isAdmin = path === "/admin";

  async function logout() {
    await signOut(auth);
    window.location.href = "/login";
  }

  // Hide on login and landing pages
  if (path === "/login" || path === "/") return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-3xl px-3 py-3">
        <div className="flex gap-2 rounded-3xl bg-white p-2 shadow-sm ring-1 ring-neutral-200">
          <Tab href="/teams" label="Teams" active={isTeams} />
          <Tab href="/admin" label="Admin" active={isAdmin} />
          <button
            onClick={logout}
            className="flex flex-1 items-center justify-center rounded-2xl px-3 py-2 text-sm font-semibold text-white transition hover:opacity-95"
            style={{ backgroundColor: MAROON }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
