import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { getModuleRows } from "@/lib/modules";
import { setModuleStatusAction } from "@/app/actions/modules";
import { ModuleStatusControl } from "@/components/admin/ModuleStatusControl";

export const metadata: Metadata = {
  title: "Gestão de Funcionalidades | Admin | FinPRO",
};

export default async function AdminModulosPage() {
  await requireRole("ADMIN");
  const modules = await getModuleRows();

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Gestão de Funcionalidades</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Controle quais abas completas cada consultor (e seus clientes) enxergam.
        </p>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--surface-border)] text-xs tracking-wide text-[var(--muted)] uppercase">
              <th className="px-4 py-3 font-medium">Módulo</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Consultores liberados</th>
              <th className="px-4 py-3 font-medium">Clientes impactados</th>
              <th className="px-4 py-3 font-medium">Ação</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <tr key={m.id} className="border-b border-[var(--surface-border)] last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--text-primary)]">{m.name}</p>
                  <p className="text-xs text-[var(--muted)]">{m.key}</p>
                </td>
                <td className="px-4 py-3">
                  <ModuleStatusControl moduleId={m.id} currentStatus={m.status} action={setModuleStatusAction} />
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {m.status === "ATIVA" ? "Todos" : m.status === "BLOQUEADA" ? "—" : m.consultoresLiberados}
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {m.status === "ATIVA" ? "Todos" : m.status === "BLOQUEADA" ? "—" : m.clientesImpactados}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/modulos/${m.key}`}
                    className="text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
                  >
                    Gerenciar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
