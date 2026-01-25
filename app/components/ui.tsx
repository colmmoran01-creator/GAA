import Link from "next/link";
import React from "react";

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {children}
    </div>
  );
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="p-4 sm:p-6">{children}</div>;
}

export function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-xl font-semibold tracking-tight">{children}</h1>;
}

export function Muted({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={`text-sm text-neutral-500 ${className}`}>{children}</p>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-neutral-700">{children}</label>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none " +
        "focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200 " +
        (props.className ?? "")
      }
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={
        "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none " +
        "focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200 " +
        (props.className ?? "")
      }
    />
  );
}

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }
) {
  const v = props.variant ?? "primary";
  const base =
    "w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-60";
  const styles =
    v === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-800"
      : "bg-neutral-100 text-neutral-900 hover:bg-neutral-200";

  return <button {...props} className={`${base} ${styles} ${props.className ?? ""}`} />;
}

export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 grid grid-cols-1 gap-2">{children}</div>;
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm font-semibold text-neutral-900 underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
