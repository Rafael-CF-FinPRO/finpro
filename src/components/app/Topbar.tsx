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
    <header className="flex h-16 items-center justify-between border-b border-[var(--surface-border)] bg-[var(--surface)] px-4 md:px-8">
      <div className="md:hidden">
        <Logo />
      </div>
      <div className="hidden md:block" />

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-slate-900">{userName}</p>
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
