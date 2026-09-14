import { formatCentsToBRL, centsToInputValue } from "@/lib/money";
import { formatDateBR, toDateInputValue } from "@/lib/dates";
import {
  PATRIMONIO_FIELD_TYPE,
  type PatrimonioFieldColumn,
} from "@/lib/patrimonio-fields";
import {
  PATRIMONIO_USAGE_LABELS,
  PATRIMONIO_LOCATION_LABELS,
  PATRIMONIO_LIQUIDITY_LABELS,
} from "@/lib/patrimonio-colors";
import type { PatrimonioAsset } from "@/generated/prisma/client";

const MUTED_DASH = <span className="text-[var(--text-faint)]">—</span>;

/** Read one field off an entity by its column key, without an `any`
 * cast — every cadastro entity (PatrimonioAsset/Liability/Protection)
 * is a plain record of primitives/Date/null as far as this generic
 * table-cell renderer is concerned. */
export function fieldValue(entity: object, key: string): unknown {
  return (entity as Record<string, unknown>)[key];
}

/** View-mode cell content for one column — the single place that knows
 * how to format every field type (money/percent/date/enum/boolean),
 * shared by AssetCategoryTable/LiabilityCategoryTable/ProtectionTable
 * so formatting never drifts between the three. */
export function renderFieldViewValue(
  key: string,
  value: unknown,
  extra?: { assets?: PatrimonioAsset[] }
): React.ReactNode {
  if (value == null || value === "") return MUTED_DASH;
  const type = PATRIMONIO_FIELD_TYPE[key];
  switch (type) {
    case "money":
      return formatCentsToBRL(value as number);
    case "percent":
      return `${String(value).replace(".", ",")}%`;
    case "date":
      return formatDateBR(value as Date);
    case "usage":
      return PATRIMONIO_USAGE_LABELS[value as string] ?? String(value);
    case "location":
      return PATRIMONIO_LOCATION_LABELS[value as string] ?? String(value);
    case "liquidity":
      return PATRIMONIO_LIQUIDITY_LABELS[value as string] ?? String(value);
    case "boolean":
      return value ? "Sim" : "Não";
    case "integer":
      return String(value);
    case "linkedAsset": {
      const asset = extra?.assets?.find((a) => a.id === value);
      return asset ? asset.name : MUTED_DASH;
    }
    case "textarea":
      return <span className="line-clamp-2 max-w-xs" title={String(value)}>{String(value)}</span>;
    default:
      return String(value);
  }
}

/** The raw DB value (cents/Date/number/enum) for one column, converted
 * to the plain string an edit row's local state should start from —
 * the same formatting `renderFieldInput` used to bake into
 * `defaultValue` before this became a controlled input (see that
 * function's comment for why). Called once, when an edit row mounts. */
export function initialFieldInputValue(key: string, rawValue: unknown): string {
  const type = PATRIMONIO_FIELD_TYPE[key];
  switch (type) {
    case "money":
      return centsToInputValue(rawValue as number | null | undefined);
    case "percent":
      return rawValue != null ? String(rawValue).replace(".", ",") : "";
    case "date":
      return rawValue ? toDateInputValue(rawValue as Date) : "";
    case "integer":
      return rawValue != null ? String(rawValue) : "";
    case "boolean":
      return rawValue == null ? "" : String(rawValue);
    default:
      return (rawValue as string) ?? "";
  }
}

/** The inline `<input>`/`<select>`/`<textarea>` for one column in edit
 * mode — `name={column.key}` so the surrounding `<form>`'s FormData
 * matches the server action's expected field names exactly, same
 * convention as every other form in this app.
 *
 * Deliberately controlled (`value`/`onChange`, driven by the edit row's
 * own React state) rather than `defaultValue` — React resets a
 * `<form>`'s uncontrolled fields after ANY bound action completes, even
 * one that returns a validation failure instead of throwing (it can't
 * tell "app-level failure" apart from "success", so it always performs
 * the reset a real form submission would). With `defaultValue` that
 * silently wiped every field the user had already typed the moment a
 * required field elsewhere failed validation — exactly what the spec's
 * "não perder os dados já preenchidos" rule forbids. Controlled inputs
 * are immune: their value always comes from state we never clear on
 * failure. */
export function renderFieldInput(
  column: PatrimonioFieldColumn,
  value: string,
  onChange: (value: string) => void,
  extra?: { assets?: PatrimonioAsset[] }
): React.ReactNode {
  const type = PATRIMONIO_FIELD_TYPE[column.key];
  const base = "field-input";

  switch (type) {
    case "money":
      return (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-[var(--muted)]">
            R$
          </span>
          <input
            name={column.key}
            type="text"
            inputMode="decimal"
            required={column.required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0,00"
            className={`${base} pl-8`}
          />
        </div>
      );
    case "percent":
      return (
        <input
          name={column.key}
          type="text"
          inputMode="decimal"
          required={column.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0,00"
          className={base}
        />
      );
    case "date":
      return (
        <input
          name={column.key}
          type="date"
          required={column.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      );
    case "integer":
      return (
        <input
          name={column.key}
          type="text"
          inputMode="numeric"
          required={column.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      );
    case "usage":
      return (
        <select
          name={column.key}
          required={column.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        >
          <option value="">{column.required ? "Selecione..." : "Não informado"}</option>
          <option value="USO_PESSOAL">Uso Pessoal</option>
          <option value="GERADOR_RENDA">Gerador de Renda</option>
        </select>
      );
    case "location":
      return (
        <select
          name={column.key}
          required={column.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        >
          <option value="">{column.required ? "Selecione..." : "Não informado"}</option>
          <option value="ONSHORE">Onshore</option>
          <option value="OFFSHORE">Offshore</option>
        </select>
      );
    case "liquidity":
      return (
        <select name={column.key} value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">Não informado</option>
          <option value="ALTA">Alta Liquidez</option>
          <option value="MEDIA">Média Liquidez</option>
          <option value="BAIXA">Baixa Liquidez</option>
        </select>
      );
    case "boolean":
      return (
        <select
          name={column.key}
          required={column.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        >
          <option value="">{column.required ? "Selecione..." : "Não informado"}</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      );
    case "linkedAsset":
      return (
        <select name={column.key} value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">Nenhum</option>
          {(extra?.assets ?? []).map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name}
            </option>
          ))}
        </select>
      );
    case "textarea":
      return (
        <textarea
          name={column.key}
          rows={1}
          required={column.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      );
    default:
      return (
        <input
          name={column.key}
          type="text"
          required={column.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      );
  }
}
