import { Logo } from "@/components/Logo";
import { LogoutButton } from "./LogoutButton";

export function Topbar({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string;
}) {
  const initial = userName.trim().charAt(0).toUpperCase() || "?";

  return (
    // Desktop shows the logo, user info and logout inside the sidebar
    // instead — this bar only exists for the viewports where the
    // sidebar is hidden.
    <header className="flex h-16 items-center justify-between border-b border-[var(--surface-border)] bg-[var(--surface)] px-4 md:hidden">
      <Logo />

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-stone-900">{userName}</p>
          <p className="text-xs text-[var(--muted)]">{userEmail}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)]/10 text-sm font-semibold text-[var(--primary)]">
          {initial}
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
