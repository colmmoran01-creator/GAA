"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BottomNav from "@/app/components/BottomNav";

const MAROON = "#7A0019";
const ROYAL = "#1E3A8A";

function NavLink({ href, label }: { href: string; label: string }) {
  const path = usePathname();
  const active = path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={[
        "rounded-xl px-3 py-2 text-sm font-semibold transition",
        active ? "text-white" : "text-neutral-700 hover:bg-neutral-100",
      ].join(" ")}
      style={active ? { backgroundColor: ROYAL } : undefined}
    >
      {label}
    </Link>
  );
}

export default function AppShell({
  title,
  children,
  showTopNav = true,
}: {
  title: string;
  children: React.ReactNode;
  showTopNav?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
         <img
  src="/club-logo.png"
  alt="Club logo"
  className="h-9 w-9 rounded-2xl object-contain bg-white ring-1 ring-neutral-200"
/>

              GAA
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">{title}</div>
              <div className="text-xs text-neutral-500 leading-tight">
                Attendance & Matches
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: ROYAL }}
            >
              Club Tools
            </span>
          </div>
        </div>

        {showTopNav && (
          <nav className="mx-auto hidden max-w-3xl px-4 pb-3 sm:block">
            <div className="flex gap-2">
              <NavLink href="/teams" label="Teams" />
              <NavLink href="/admin" label="Admin" />
            </div>
          </nav>
        )}
      </header>

      {/* Padding-bottom so content doesn't sit behind bottom nav */}
      <main className="mx-auto max-w-3xl px-4 py-4 pb-28">{children}</main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
