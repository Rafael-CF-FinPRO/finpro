"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "./LogoutButton";
import { NAV_ITEMS } from "./nav-items";

// Remembers the collapsed/expanded state across visits — purely a
// per-browser UI preference, not user data, so localStorage (not the
// database) is the right place for it.
const COLLAPSE_STORAGE_KEY = "finpro:sidebar-collapsed";

function NavLinks({
  direction,
  collapsed,
}: {
  direction: "vertical" | "horizontal";
  collapsed?: boolean;
}) {
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
            title={collapsed ? item.label : undefined}
            className={`flex items-center gap-3 whitespace-nowrap rounded-lg py-2.5 text-sm font-medium transition-colors ${
              collapsed ? "justify-center px-2.5" : "px-3"
            } ${
              isActive
                ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            }`}
          >
            <Icon className="shrink-0" />
            {!collapsed && item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Deferred rather than called synchronously in the effect body, to
    // avoid cascading renders during mount.
    const timeout = setTimeout(() => {
      try {
        setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
      } catch {
        // localStorage unavailable (private mode, etc.) — default to expanded.
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore — the toggle still works for this session either way.
      }
      return next;
    });
  }

  const initial = userName.trim().charAt(0).toUpperCase() || "?";

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[var(--surface-border)] bg-[var(--surface)] transition-[width] duration-200 md:flex ${
        collapsed ? "w-20" : "w-64"
      } ${ready ? "" : "duration-0"}`}
    >
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        className="absolute top-1/2 right-0 z-10 flex h-6 w-6 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-[var(--surface-border)] bg-[var(--surface)] text-stone-500 shadow-sm transition-colors hover:bg-stone-50 hover:text-stone-700"
      >
        {collapsed ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}
      </button>

      <div
        className={`flex h-16 shrink-0 items-center border-b border-[var(--surface-border)] ${
          collapsed ? "justify-center px-2" : "px-6"
        }`}
      >
        <Logo iconOnly={collapsed} />
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
        <NavLinks direction="vertical" collapsed={collapsed} />
      </div>

      <div className="shrink-0 border-t border-[var(--surface-border)] p-4">
        {collapsed ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-sm font-semibold text-[var(--primary)]"
              title={`${userName} · ${userEmail}`}
            >
              {initial}
            </div>
            <LogoutButton collapsed />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-sm font-semibold text-[var(--primary)]">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-900">{userName}</p>
                <p className="truncate text-xs text-[var(--muted)]">{userEmail}</p>
              </div>
            </div>
            <div className="mt-2">
              <LogoutButton />
            </div>
          </>
        )}
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
