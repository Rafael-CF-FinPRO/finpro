import { ProfileInfoCard } from "./ProfileInfoCard";
import { ChangePasswordCard } from "./ChangePasswordCard";

export function ProfileScreen({
  user,
}: {
  user: { name: string; email: string; phone: string | null };
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Meu Perfil</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Seus dados de cadastro e segurança.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProfileInfoCard name={user.name} email={user.email} phone={user.phone} />
        <ChangePasswordCard />
      </div>
    </div>
  );
}
