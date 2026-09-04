import {
  Heart,
  UtensilsCrossed,
  GraduationCap,
  LayoutGrid,
  Home,
  PawPrint,
  Wrench,
  Shield,
  Landmark,
  Car,
  Receipt,
  UserRound,
  Users,
  Plane,
  Repeat,
  ShoppingBag,
  Coffee,
  Gamepad2,
  Gift,
  Shirt,
  MoreHorizontal,
  CreditCard,
  Briefcase,
  TrendingUp,
  Target,
  Tag,
  Undo2,
  ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";

// Keyed by the exact canonical category name (see
// src/lib/default-categories.ts) — a category the user renamed, or
// created themselves, falls back to a generic icon rather than showing
// nothing. Some names (Pets, Transporte, Cuidados Pessoais, Prestadores
// de Serviço e Serviços) appear once here even though the category
// itself exists under two different Classifications — same concept,
// same icon either way.
const CATEGORY_ICON_BY_NAME: Record<string, LucideIcon> = {
  // Custos Obrigatórios
  Moradia: Home,
  Alimentação: UtensilsCrossed,
  Saúde: Heart,
  Educação: GraduationCap,
  Transporte: Car,
  Seguros: Shield,
  Impostos: Receipt,
  "Filhos e Família": Users,
  Pets: PawPrint,
  "Prestadores de Serviço e Serviços": Wrench,
  "Serviços Financeiros": Landmark,
  "Financiamentos e Compromissos Financeiros": CreditCard,
  "Outros Custos Obrigatórios": LayoutGrid,

  // Prazeres e Confortos
  "Viagens e Passeios": Plane,
  "Lanches, Restaurantes e Confraternizações": Coffee,
  "Lazer e Diversão": Gamepad2,
  Assinaturas: Repeat,
  Compras: ShoppingBag,
  "Roupas e Vestuário": Shirt,
  "Presentes e Doações": Gift,
  "Cuidados Pessoais": UserRound,
  "Outros Prazeres e Confortos": MoreHorizontal,

  // Investimentos
  "Carteira de Investimentos": Briefcase,
  "Metas e Projetos": Target,
  "Outros Investimentos": TrendingUp,

  // Neutro
  "Pagamento de Fatura": CreditCard,
  Reembolso: Undo2,
  "Transferência entre Contas": ArrowLeftRight,
};

const FALLBACK_ICON: LucideIcon = Tag;

export function getCategoryIcon(name: string): LucideIcon {
  return CATEGORY_ICON_BY_NAME[name] ?? FALLBACK_ICON;
}
