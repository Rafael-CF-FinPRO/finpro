import {
  Heart,
  UtensilsCrossed,
  GraduationCap,
  LayoutGrid,
  ShoppingCart,
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
  HandCoins,
  Banknote,
  FileText,
  CreditCard,
  Briefcase,
  TrendingUp,
  Tag,
  type LucideIcon,
} from "lucide-react";

// Keyed by the exact canonical category name (see
// src/lib/default-categories.ts) — a category the user renamed, or
// created themselves, falls back to a generic icon rather than showing
// nothing.
const CATEGORY_ICON_BY_NAME: Record<string, LucideIcon> = {
  // Essenciais
  Saúde: Heart,
  Alimentação: UtensilsCrossed,
  Educação: GraduationCap,
  "Essenciais Geral": LayoutGrid,
  Mercado: ShoppingCart,
  Moradia: Home,
  "Pets - Essencial": PawPrint,
  "Prestadores de Serviço - Essencial": Wrench,
  Seguros: Shield,
  "Serviços Financeiros": Landmark,
  "Transporte - Essencial": Car,
  Imposto: Receipt,
  "Cuidados Pessoais - Essencial": UserRound,
  "Filhos e Família": Users,

  // Não Essenciais
  "Viagens e Passeios": Plane,
  Assinaturas: Repeat,
  Compras: ShoppingBag,
  "Lanches, Restaurante e Confraternizações": Coffee,
  "Lazer e Diversão": Gamepad2,
  "Pets - Não Essencial": PawPrint,
  "Presentes e Doações": Gift,
  "Cuidados Pessoais - Não Essencial": UserRound,
  "Prestadores de Serviço - Não Essencial": Wrench,
  "Roupas e Vestuário": Shirt,
  "Transporte - Não Essencial": Car,
  "Outros Não Essenciais": MoreHorizontal,

  // Dívidas
  Consórcio: HandCoins,
  Empréstimo: Banknote,
  Financiamento: FileText,
  "Financiamentos e Dívidas Geral": CreditCard,
  "Parcelamento Cartão": CreditCard,

  // Investimentos
  "Carteira de Investimentos": Briefcase,
  "Outros Investimentos": TrendingUp,
};

const FALLBACK_ICON: LucideIcon = Tag;

export function getCategoryIcon(name: string): LucideIcon {
  return CATEGORY_ICON_BY_NAME[name] ?? FALLBACK_ICON;
}
