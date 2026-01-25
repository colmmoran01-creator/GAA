"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

function NavLink({ href, label }: { href: string; label: string }) {
  const path = usePathname();
  const active = path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={[
        "rounded-xl px-3 py-2 text-sm font-semibold transition",
        active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function AppShell({
  title,
  children,
  showNav = true,
}: {
  title: string;
  children: React.ReactNode;
  showNav?: boolean;
}) {
  async function logout() {
    await signOut(auth);
    window.location.href = "/";
  }

  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-neutral-900 text-white font-black">
              GAA
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">{title}</div>
              <div className="text-xs text-neutral-500 leading-tight">Attendance & Matches</div>
            </div>
          </div>

          <button
            onClick={logout}
            className="rounded-xl bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-200"
          >
            Logout
          </button>
        </div>

        {showNav && (
          <nav className="mx-auto max-w-3xl px-4 pb-3">
            <div className="flex gap-2">
              <NavLink href="/teams" label="Teams" />
              <NavLink href="/admin" label="Admin" />
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">{children}</main>
    </div>
  );
}
