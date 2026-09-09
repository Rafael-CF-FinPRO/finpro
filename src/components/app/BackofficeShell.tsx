"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "./LogoutButton";
import { ThemeToggle } from "./ThemeToggle";

export type BackofficeNavItem = { href: string; label: string };

/** Shared chrome for /admin and /consultor — deliberately a plain
 * topbar, not the Sidebar the Cliente gets (src/components/app/Sidebar.tsx):
 * both of these environments are meant to stay simple (spec: "ambiente
 * simples", "não uma CRM complexa"), and reusing the Cliente's own
 * Sidebar (built around NAV_ITEMS, the Cliente's own tabs) would either
 * require changing that shared component or duplicating it — this small
 * shell is new code the Cliente experience never renders, so it carries
 * zero risk to it either way. */
export function BackofficeShell({
  roleLabel,
  navItems,
  userName,
  profileHref,
  children,
}: {
  roleLabel: string;
  navItems: BackofficeNavItem[];
  userName: string;
  profileHref: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <header className="border-b border-[var(--surface-border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex flex-wrap items-center gap-3 md:gap-6">
            <Logo />
            <span className="rounded-full bg-[var(--primary)]/10 px-2.5 py-1 text-xs font-medium text-[var(--primary)]">
              {roleLabel}
            </span>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                        : "text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={profileHref}
              title="Meu Perfil"
              className="hidden text-sm text-[var(--muted)] transition-colors hover:text-[var(--text-primary)] sm:inline"
            >
              {userName}
            </Link>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
