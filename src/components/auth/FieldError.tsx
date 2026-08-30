export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return <p className="mt-1.5 text-sm text-[var(--danger)]">{messages[0]}</p>;
}
