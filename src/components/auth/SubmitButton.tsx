"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Enviando..." : children}
    </button>
  );
}
