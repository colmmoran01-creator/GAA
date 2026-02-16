"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { getAuth, signOut } from "firebase/auth";

type Props = {
  title: string;
  children: ReactNode;
  showTopNav?: boolean;
};

export default function AppShell({
  title,
  children,
  showTopNav = true,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    const auth = getAuth();
    await signOut(auth);
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* HEADER */}
      <header className="bg-gradient-to-r from-[#7A0019] to-[#1E3A8A] text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          {/* Logo / Title */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="text-lg font-bold tracking-wide">
                {title}
              </div>
            </Link>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {pathname !== "/" && (
              <Link
                href="/"
                className="rounded-full bg-white/20 px-3 py-2 text-lg transition hover:bg-white/30"
                title="Home"
              >
                🏠
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-100"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Optional top nav */}
        {showTopNav && (
          <nav className="mx-auto flex max-w-6xl gap-4 px-4 pb-3 text-sm">
            <Link href="/" className="hover:underline">
              Home
            </Link>
            <Link href="/teams" className="hover:underline">
              Teams
            </Link>
            <Link href="/admin" className="hover:underline">
              Admin
            </Link>
            <Link href="/contacts" className="hover:underline">
              Contacts
            </Link>
          </nav>
        )}
      </header>

      {/* PAGE CONTENT */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
