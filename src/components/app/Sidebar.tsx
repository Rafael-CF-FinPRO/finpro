"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { NAV_ITEMS } from "./nav-items";

function NavLinks({ direction }: { direction: "vertical" | "horizontal" }) {
  const pathname = usePathname();

  return (
    <nav
      className={
        direction === "vertical"
          ? "space-y-1"
          : "flex gap-1 overflow-x-auto"
      }
    >
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            }`}
          >
            <Icon className="shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-[var(--surface-border)] bg-[var(--surface)] md:flex md:flex-col">
      <div className="flex h-16 items-center border-b border-[var(--surface-border)] px-6">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <NavLinks direction="vertical" />
      </div>
    </aside>
  );
}

export function MobileNav() {
  return (
    <div className="border-b border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 md:hidden">
      <NavLinks direction="horizontal" />
    </div>
  );
}
