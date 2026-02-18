"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useProfile } from "@/lib/useProfile";
import AppShell from "@/app/components/AppShell";

type Row = {
  id: string;
  email?: string;
  displayName?: string;
  role?: "coach" | "admin";
};

export default function AdminUsersPage() {
  const { profile, loading: profileLoading } = useProfile();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    (async () => {
      setLoading(true);
      const q = query(collection(db, "users"), orderBy("displayName"));
      const snap = await getDocs(q);

      const list: Row[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          email: data.email,
          displayName: data.displayName,
          role: data.role || "coach",
        };
      });

      setRows(list);
      setLoading(false);
    })();
  }, []);

  if (profileLoading) {
    return (
      <AppShell title="User Management">
        <div className="py-10 text-sm text-neutral-600">Loading…</div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="User Management">
        <div className="text-sm">Admins only</div>
      </AppShell>
    );
  }

  async function saveRole(uid: string, role: "coach" | "admin") {
    await updateDoc(doc(db, "users", uid), { role });
    setMsg("Saved");
    setTimeout(() => setMsg(""), 1500);
  }

  return (
    <AppShell title="User Management">
      <div className="mb-4 flex justify-between">
        <Link href="/admin" className="text-blue-600 underline">
          ← Back to Admin
        </Link>
        {msg && <div className="text-sm text-green-600">{msg}</div>}
      </div>

      <div className="rounded-2xl border bg-white shadow-sm">
        {loading && <div className="p-4 text-sm">Loading users…</div>}

        {!loading &&
          rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b px-4 py-3 text-sm">
              <div>
                <div className="font-semibold">{r.displayName}</div>
                <div className="text-xs text-neutral-500">{r.email}</div>
              </div>

              <select
                value={r.role}
                onChange={(e) => saveRole(r.id, e.target.value as "coach" | "admin")}
                className="rounded-xl border px-2 py-1"
              >
                <option value="coach">Coach</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          ))}
      </div>
    </AppShell>
  );
}
