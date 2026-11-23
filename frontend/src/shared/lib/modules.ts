import {
  Briefcase,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ModuleKey } from "../api/auth";

export interface ErpModuleDefinition {
  id: string;
  index: string;
  label: string;
  path: string;
  end?: boolean;
  icon: LucideIcon;
  optionalKey?: ModuleKey;
  description: string;
}

export const ERP_MODULES: ErpModuleDefinition[] = [
  {
    id: "dashboard",
    index: "01",
    label: "Tableau de bord",
    path: "/app",
    end: true,
    icon: LayoutDashboard,
    description: "Vue d'ensemble de l'entreprise et indicateurs clés.",
  },
  {
    id: "crm",
    index: "02",
    label: "Clients & CRM",
    path: "/app/clients",
    icon: Users,
    optionalKey: "crm",
    description: "Répertoire clients, import Excel (.xlsx) et export CSV.",
  },
  {
    id: "sales",
    index: "03",
    label: "Opportunités",
    path: "/app/sales",
    icon: Briefcase,
    optionalKey: "sales",
    description: "Pipeline commercial, montants et suivi des ventes.",
  },
  {
    id: "team",
    index: "04",
    label: "Équipe & Rôles",
    path: "/app/team",
    icon: ShieldCheck,
    description: "Collaborateurs, invitations et gestion des permissions.",
  },
  {
    id: "settings",
    index: "05",
    label: "Paramètres",
    path: "/app/settings",
    icon: Settings,
    description: "Configuration de l'entreprise et activation des modules.",
  },
];

export const OPTIONAL_MODULES: Array<{
  key: ModuleKey;
  label: string;
  description: string;
}> = [
  {
    key: "crm",
    label: "Clients & CRM",
    description:
      "Gestion des contacts, fiche client, import Excel (.xlsx) et export CSV.",
  },
  {
    key: "sales",
    label: "Opportunités & Ventes",
    description:
      "Pipeline commercial par étapes relié directement à vos clients CRM.",
  },
];
