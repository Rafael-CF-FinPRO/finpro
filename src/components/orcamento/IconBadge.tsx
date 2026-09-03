import type { LucideIcon } from "lucide-react";
import { withAlpha } from "@/lib/classification-colors";

/**
 * A small round icon badge, shared by every classification/category
 * display in the Orçamento module (dashboard cards, pie chart legend,
 * the board's classification headers, category rows). Two variants
 * give the two levels a deliberate color contrast while staying in the
 * same color family:
 *  - "solid": full classification color, white icon — used for the
 *    Classification itself.
 *  - "soft": a light tint of that same color, with the color itself as
 *    the icon — used for its Categories, so they read as "part of this
 *    classification" without competing with it visually.
 */
export function IconBadge({
  icon: Icon,
  color,
  variant = "solid",
  size = "md",
}: {
  icon: LucideIcon;
  color: string;
  variant?: "solid" | "soft";
  size?: "sm" | "md";
}) {
  const dimensionClass = size === "sm" ? "h-5 w-5" : "h-7 w-7";
  const iconSize = size === "sm" ? 12 : 16;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${dimensionClass}`}
      style={
        variant === "solid"
          ? { backgroundColor: color, color: "#fff" }
          : { backgroundColor: withAlpha(color, "26"), color }
      }
    >
      <Icon size={iconSize} strokeWidth={2.25} />
    </span>
  );
}
