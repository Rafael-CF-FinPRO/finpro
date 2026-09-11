/** Senha é sempre definida por um superior (Admin/Consultor) — nesta
 * versão não há troca de senha pelo próprio usuário, ver
 * src/app/actions/consultor.ts's resetClientPasswordAction e
 * src/app/actions/admin.ts's resetConsultorPasswordAction. */
export function ChangePasswordCard() {
  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Segurança</h2>

      <div className="mt-4">
        <p className="field-label">Senha</p>
        <p className="text-sm text-[var(--text-primary)]">••••••••</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Senha gerenciada pelo administrador ou consultor.
        </p>
      </div>
    </div>
  );
}
