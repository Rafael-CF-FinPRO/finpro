"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Download, FileSpreadsheet, FileText, Landmark } from "lucide-react";
import {
  parseOfxImportAction,
  parsePdfImportAction,
  parseSpreadsheetImportAction,
} from "@/app/actions/import";
import type { ParsedTransactionRow, ParseResult } from "@/lib/import/types";
import { ImportReviewTable } from "./ImportReviewTable";
import type { Classification } from "@/generated/prisma/enums";

type CategoryOption = {
  id: string;
  name: string;
  type: "ENTRADA" | "SAIDA";
  classification: Classification;
  isActive: boolean;
};
type SimpleOption = { id: string; name: string };

type Step =
  | { kind: "pick" }
  | { kind: "review"; rows: ParsedTransactionRow[] }
  | { kind: "done"; count: number };

const SOURCES = [
  {
    key: "ofx",
    label: "Extrato OFX",
    description: "Arquivo .ofx exportado pelo internet banking do seu banco.",
    accept: ".ofx",
    icon: Landmark,
    action: parseOfxImportAction,
  },
  {
    key: "pdf",
    label: "Extrato em PDF",
    description: "Leitura automática do PDF — sempre revise os lançamentos antes de importar.",
    accept: ".pdf",
    icon: FileText,
    action: parsePdfImportAction,
  },
  {
    key: "planilha",
    label: "Planilha",
    description: "Baixe o modelo, preencha em Excel e envie de volta.",
    accept: ".xlsx,.xls,.csv",
    icon: FileSpreadsheet,
    action: parseSpreadsheetImportAction,
  },
] as const;

export function ImportWizard({
  categories,
  paymentMethods,
  tags,
  onClose,
}: {
  categories: CategoryOption[];
  paymentMethods: SimpleOption[];
  tags: SimpleOption[];
  /** Called when the user is done with the wizard (after a successful
   * import, or if the host wants a "close" affordance). The host is
   * responsible for hiding/unmounting the wizard — this component has no
   * standalone page of its own to navigate away from. */
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [pendingSource, setPendingSource] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  function handleFile(
    sourceKey: string,
    action: (formData: FormData) => Promise<ParseResult>,
    file: File
  ) {
    setErrors((prev) => ({ ...prev, [sourceKey]: "" }));
    setPendingSource(sourceKey);
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await action(formData);
      setPendingSource(null);
      if (result.error || !result.rows) {
        setErrors((prev) => ({ ...prev, [sourceKey]: result.error ?? "Não foi possível ler o arquivo." }));
        return;
      }
      setStep({ kind: "review", rows: result.rows });
    });
  }

  if (step.kind === "done") {
    return (
      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-bg)] text-[var(--success)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="font-medium text-stone-900">
          {step.count} {step.count === 1 ? "lançamento importado" : "lançamentos importados"} com sucesso.
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn-primary" onClick={onClose}>
            Concluir
          </button>
          <button type="button" className="btn-secondary" onClick={() => setStep({ kind: "pick" })}>
            Importar mais
          </button>
        </div>
      </div>
    );
  }

  if (step.kind === "review") {
    return (
      <ImportReviewTable
        initialRows={step.rows}
        categories={categories}
        paymentMethods={paymentMethods}
        tags={tags}
        onCancel={() => setStep({ kind: "pick" })}
        onImported={(count) => setStep({ kind: "done", count })}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {SOURCES.map((source) => {
        const Icon = source.icon;
        const isPending = pendingSource === source.key;
        return (
          <div key={source.key} className="card flex flex-col gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
              <Icon size={20} />
            </div>
            <div>
              <p className="font-medium text-stone-900">{source.label}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{source.description}</p>
            </div>

            {source.key === "planilha" && (
              <a
                href="/api/import/template"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
              >
                <Download size={14} /> Baixar modelo
              </a>
            )}

            <label className="btn-secondary mt-auto cursor-pointer justify-center">
              {isPending ? "Enviando..." : "Selecionar arquivo"}
              <input
                type="file"
                accept={source.accept}
                className="hidden"
                disabled={pendingSource !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleFile(source.key, source.action, file);
                }}
              />
            </label>

            {errors[source.key] && (
              <p className="flex items-start gap-1.5 text-sm text-[var(--danger)]">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {errors[source.key]}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
