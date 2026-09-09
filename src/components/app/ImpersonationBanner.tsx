import { stopImpersonationAction } from "@/app/actions/consultor";

/** Rendered only while a CONSULTOR/ADMIN is impersonating a CLIENTE —
 * see src/app/(app)/layout.tsx, which only mounts this when
 * session.isImpersonating is true. A real CLIENTE never sees this, so
 * their own layout is visually unchanged. */
export function ImpersonationBanner({ clientName }: { clientName: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-[var(--warning-bg)] px-4 py-2 text-sm text-[var(--warning)]">
      <p>
        Você está atuando como <span className="font-semibold">{clientName}</span>
      </p>
      <form action={stopImpersonationAction}>
        <button
          type="submit"
          className="rounded-lg border border-[var(--warning)]/40 px-3 py-1 text-xs font-medium transition-colors hover:bg-[var(--warning)]/10"
        >
          Voltar para Clientes
        </button>
      </form>
    </div>
  );
}
