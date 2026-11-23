import {
  Briefcase,
  FolderKanban,
  LayoutDashboard,
  Package,
  ScrollText,
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
    description: "Vue d'ensemble, graphiques et indicateurs clés.",
  },
  {
    id: "projects",
    index: "02",
    label: "Projets & Tâches",
    path: "/app/projects",
    icon: FolderKanban,
    optionalKey: "projects",
    description: "Projets, collaboration d'équipe et assignation des tâches.",
  },
  {
    id: "stock",
    index: "03",
    label: "Stock & Produits",
    path: "/app/stock",
    icon: Package,
    optionalKey: "stock",
    description: "Inventaire, seuils d'alerte, entrées et sorties de stock.",
  },
  {
    id: "crm",
    index: "04",
    label: "Clients & CRM",
    path: "/app/clients",
    icon: Users,
    optionalKey: "crm",
    description: "Répertoire clients, import Excel (.xlsx) et export CSV.",
  },
  {
    id: "sales",
    index: "05",
    label: "Opportunités",
    path: "/app/sales",
    icon: Briefcase,
    optionalKey: "sales",
    description: "Pipeline commercial, montants et suivi des ventes.",
  },
  {
    id: "team",
    index: "06",
    label: "Équipe & Employés",
    path: "/app/team",
    icon: ShieldCheck,
    description: "Recherche d'employés par email, invitations et rôles.",
  },
  {
    id: "logs",
    index: "07",
    label: "Journal & Logs",
    path: "/app/logs",
    icon: ScrollText,
    description: "Historique complet et traçabilité des actions effectuées.",
  },
  {
    id: "settings",
    index: "08",
    label: "Paramètres",
    path: "/app/settings",
    icon: Settings,
    description: "Configuration de l'espace et activation des modules.",
  },
];

export const OPTIONAL_MODULES: Array<{
  key: ModuleKey;
  label: string;
  description: string;
}> = [
  {
    key: "projects",
    label: "Projets & Tâches",
    description:
      "Création de projets, invitation de collaborateurs et suivi des tâches.",
  },
  {
    key: "stock",
    label: "Gestion de Stock",
    description:
      "Catalogue articles, mouvements entrées/sorties et alertes de réapprovisionnement.",
  },
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
