import {
  LayoutDashboard,
  BarChart3,
  MessageSquareText,
  LayoutGrid,
  Radio,
  Bot,
  Megaphone,
  Users,
  Layers,
  Settings,
  Tag,
  History,
  Building2,
  Download,
  Contact,
  ShoppingBag,
  Package,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    title: "Geral",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    title: "Atendimento",
    items: [
      { href: "/canais", label: "Canais", icon: Radio },
      { href: "/atendimento", label: "Atendimento", icon: MessageSquareText },
      { href: "/atendimento-v2", label: "Atendimento V2", icon: LayoutGrid },
      { href: "/mensagens", label: "Mensagens", icon: Tag },
      { href: "/automacoes", label: "Automações", icon: Bot },
      { href: "/campanhas", label: "Campanhas", icon: Megaphone },
    ],
  },
  {
    title: "Loja",
    items: [
      { href: "/catalogo", label: "Catálogo", icon: ShoppingBag },
      { href: "/pedidos", label: "Pedidos", icon: Package },
      { href: "/clientes", label: "Clientes", icon: Contact },
      { href: "/api/export-contacts", label: "Exportar contatos", icon: Download },
    ],
  },
  {
    title: "Empresa",
    items: [
      { href: "/empresa", label: "Dados da empresa", icon: Building2 },
      { href: "/atendentes", label: "Atendentes", icon: Users },
      { href: "/departamentos", label: "Departamentos", icon: Layers },
      { href: "/auditoria", label: "Auditoria", icon: History },
      { href: "/ajustes", label: "Ajustes", icon: Settings },
    ],
  },
];

export const ALL_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);
