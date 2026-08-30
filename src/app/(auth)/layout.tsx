import { Logo } from "@/components/Logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4 py-12">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-sm">
        <div className="card p-8">{children}</div>
        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          Organize, planeje e acompanhe sua vida financeira.
        </p>
      </div>
    </div>
  );
}
