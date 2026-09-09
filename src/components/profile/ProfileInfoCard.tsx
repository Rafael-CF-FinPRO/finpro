"use client";

import { useActionState } from "react";
import { updateProfileAction, type ProfileActionState } from "@/app/actions/profile";
import { FieldError } from "@/components/auth/FieldError";
import { SubmitButton } from "@/components/auth/SubmitButton";

const initialState: ProfileActionState = {};

export function ProfileInfoCard({
  name,
  email,
  phone,
}: {
  name: string;
  email: string;
  phone: string | null;
}) {
  const [state, formAction] = useActionState(updateProfileAction, initialState);

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Dados pessoais</h2>

      <form action={formAction} className="mt-4 space-y-4" noValidate>
        {state.error && <p className="alert-error">{state.error}</p>}
        {state.success && <p className="alert-success">Perfil atualizado com sucesso.</p>}

        <div>
          <label htmlFor="profile-name" className="field-label">
            Nome
          </label>
          <input
            id="profile-name"
            name="name"
            type="text"
            required
            defaultValue={name}
            className="field-input"
          />
          <FieldError messages={state.fieldErrors?.name} />
        </div>

        <div>
          <label htmlFor="profile-email" className="field-label">
            E-mail (Login)
          </label>
          <input
            id="profile-email"
            type="email"
            value={email}
            disabled
            className="field-input cursor-not-allowed opacity-60"
          />
        </div>

        <div>
          <label htmlFor="profile-phone" className="field-label">
            Contato telefônico
          </label>
          <input
            id="profile-phone"
            name="phone"
            type="tel"
            defaultValue={phone ?? ""}
            placeholder="(11) 91234-5678"
            className="field-input"
          />
          <FieldError messages={state.fieldErrors?.phone} />
        </div>

        <SubmitButton>Salvar</SubmitButton>
      </form>
    </div>
  );
}
