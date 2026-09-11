import type { Metadata } from "next";
import { requireRole } from "@/lib/rbac";
import { getConsultorRows } from "@/lib/admin";
import { setConsultorStatusAction } from "@/app/actions/admin";
import { NewConsultorButton } from "@/components/admin/NewConsultorButton";
import { EditConsultorButton } from "@/components/admin/EditConsultorButton";
import { ResetConsultorPasswordButton } from "@/components/admin/ResetConsultorPasswordButton";
import { UserStatusControl } from "@/components/app/UserStatusControl";

export const metadata: Metadata = {
  title: "Consultores | Admin | FinPRO",
};

export default async function AdminConsultoresPage() {
  await requireRole("ADMIN");
  const consultores = await getConsultorRows();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Consultores</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {consultores.length === 0
              ? "Nenhum consultor cadastrado ainda."
              : `${consultores.length} consultor(es) cadastrado(s).`}
          </p>
        </div>
        <NewConsultorButton />
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--surface-border)] text-xs tracking-wide text-[var(--muted)] uppercase">
              <th className="px-4 py-3 font-medium">Consultor</th>
              <th className="px-4 py-3 font-medium">Clientes</th>
              <th className="px-4 py-3 font-medium">Status da conta</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {consultores.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">
                  Nenhum consultor encontrado.
                </td>
              </tr>
            ) : (
              consultores.map((consultor) => (
                <tr key={consultor.id} className="border-b border-[var(--surface-border)] last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--text-primary)]">{consultor.name}</p>
                    <p className="text-xs text-[var(--muted)]">{consultor.email}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{consultor.clientCount}</td>
                  <td className="px-4 py-3">
                    <UserStatusControl
                      userId={consultor.id}
                      currentStatus={consultor.status}
                      options={["ATIVO", "INATIVO", "BLOQUEADO"]}
                      action={setConsultorStatusAction}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <EditConsultorButton
                        consultorId={consultor.id}
                        initialName={consultor.name}
                        initialEmail={consultor.email}
                      />
                      <ResetConsultorPasswordButton
                        consultorId={consultor.id}
                        consultorName={consultor.name}
                      />
                    </div>
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
