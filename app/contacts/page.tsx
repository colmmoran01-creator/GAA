"use client";

import Link from "next/link";
import AppShell from "../components/AppShell";

type Contact = { role: string; name: string; phone?: string; email?: string };

const CONTACTS: Contact[] = [
  { role: "Chairman", name: "Niall Colgan", phone: "087 717 9237", email: "chairperson.marylandtang.westmeath@gaa.ie" },
  { role: "Secretary", name: "Colm Moran", phone: "087 205 3648", email: "Secretarybng.marylandtang.westmeath@gaa.ie" },
  { role: "Treasurer", name: "Ciaran McLoughlin", phone: "087 983 4001", email: "treasurer.marylandtang.westmeath@gaa.ie" },
  { role: "PRO", name: "Marise O'Toole", phone: "086 176 8500", email: "pro.marylandtang.westmeath@gmail.com" },
  { role: "Child Protection Officer (Maryland)", name: "Donal Hogan", phone: "086 157 5593", email: "" },
  { role: "Child Protection Officer (Tang)", name: "Michael Bannon", phone: "086 102 5244", email: "" },
  { role: "Coaching Officer (Maryland)", name: "Aidan Reynolds", phone: "087 905 2468", email: "" },
  { role: "Coaching Officer (Tang)", name: "Robert English", phone: "087 124 9140", email: "" },
  { role: "Pitch Co-ordinator (Maryland)", name: "Danny Connaughton", phone: "087 799 6207", email: "" },
  { role: "Pitch Co-ordinator (Tang)", name: "Fiona Lennon", phone: "087 819 7855", email: "" },
];

export default function ContactsPage() {
  return (
    <AppShell title="Contacts" showTopNav={true}>
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Club Contacts</h1>
            <p className="mt-1 text-sm text-neutral-600">
            
            </p>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50"
          >
            ← Home
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {CONTACTS.map((c) => (
            <div key={c.role} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-sm font-semibold text-neutral-900">{c.role}</div>
              <div className="mt-1 text-sm text-neutral-800">{c.name}</div>

              {(c.phone || c.email) && (
                <div className="mt-2 text-sm text-neutral-700">
                  {c.phone && <div>📞 {c.phone}</div>}
                  {c.email && <div>✉️ {c.email}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
