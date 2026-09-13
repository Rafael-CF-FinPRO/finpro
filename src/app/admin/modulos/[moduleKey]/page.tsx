import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { getModuleByKey, getModuleConsultorAccessRows } from "@/lib/modules";
import { setConsultorModuleAccessAction } from "@/app/actions/modules";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ moduleKey: string }>;
}): Promise<Metadata> {
  const { moduleKey } = await params;
  const module_ = await getModuleByKey(moduleKey);
  return { title: `${module_?.name ?? "Módulo"} | Gestão de Funcionalidades | FinPRO` };
}

export default async function AdminModuloConsultoresPage({
  params,
}: {
  params: Promise<{ moduleKey: string }>;
}) {
  await requireRole("ADMIN");
  const { moduleKey } = await params;

  const module_ = await getModuleByKey(moduleKey);
  if (!module_) notFound();

  const rows = await getModuleConsultorAccessRows(module_.id);

  return (
    <div>
      <Link href="/admin/modulos" className="text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]">
        ← Gestão de Funcionalidades
      </Link>

      <div className="mt-3">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{module_.name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {module_.status === "ATIVA"
            ? "Módulo ativo — liberado para todos os consultores e clientes."
            : module_.status === "BLOQUEADA"
              ? "Módulo bloqueado — ninguém tem acesso, mesmo com liberação individual registrada."
              : "Módulo em desenvolvimento — liberado somente para os consultores marcados abaixo."}
        </p>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--surface-border)] text-xs tracking-wide text-[var(--muted)] uppercase">
              <th className="px-4 py-3 font-medium">Consultor</th>
              <th className="px-4 py-3 font-medium">Clientes vinculados</th>
              <th className="px-4 py-3 font-medium">Liberação</th>
              <th className="px-4 py-3 font-medium">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">
                  Nenhum consultor cadastrado ainda.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.consultorId} className="border-b border-[var(--surface-border)] last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--text-primary)]">{row.name}</p>
                    <p className="text-xs text-[var(--muted)]">{row.email}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{row.clientCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                        row.isEnabled
                          ? "bg-[var(--success-bg)] text-[var(--success)]"
                          : "bg-[var(--surface-hover)] text-[var(--muted)]"
                      }`}
                    >
                      {row.isEnabled ? "Liberado" : "Bloqueado"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <form action={setConsultorModuleAccessAction}>
                      <input type="hidden" name="moduleId" value={module_.id} />
                      <input type="hidden" name="consultorId" value={row.consultorId} />
                      <input type="hidden" name="isEnabled" value={(!row.isEnabled).toString()} />
                      <button
                        type="submit"
                        className="text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
                      >
                        {row.isEnabled ? "Bloquear" : "Liberar"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
