import { createBrowserRouter } from "react-router-dom";
import LandingPage from "../features/landing/LandingPage";
import { RegisterPage } from "../features/auth/RegisterPage";
import { LoginPage } from "../features/auth/LoginPage";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { AppLayout } from "../features/dashboard/AppLayout";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { ProjectsPage } from "../features/projects/ProjectsPage";
import { StockPage } from "../features/stock/StockPage";
import { ClientsPage } from "../features/crm/ClientsPage";
import { SalesPage } from "../features/sales/SalesPage";
import { CaissePage } from "../features/sales/CaissePage";
import { TeamPage } from "../features/users/TeamPage";
import { LogsPage } from "../features/logs/LogsPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { NotFoundPage } from "./NotFoundPage";
import { ErrorFallbackView } from "./ErrorPage";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <LandingPage />,
      errorElement: <ErrorFallbackView />,
    },
    {
      path: "/register",
      element: <RegisterPage />,
      errorElement: <ErrorFallbackView />,
    },
    {
      path: "/login",
      element: <LoginPage />,
      errorElement: <ErrorFallbackView />,
    },
    {
      path: "/app",
      errorElement: <ErrorFallbackView />,
      element: (
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      ),
      children: [
        {
          index: true,
          element: <DashboardPage />,
        },
        {
          path: "projects",
          element: <ProjectsPage />,
        },
        {
          path: "stock",
          element: <StockPage />,
        },
        {
          path: "clients",
          element: <ClientsPage />,
        },
        {
          path: "sales",
          element: <SalesPage />,
        },
        {
          path: "caisse",
          element: <CaissePage />,
        },
        {
          path: "team",
          element: <TeamPage />,
        },
        {
          path: "logs",
          element: <LogsPage />,
        },
        {
          path: "settings",
          element: <SettingsPage />,
        },
      ],
    },
    {
      path: "*",
      element: <NotFoundPage />,
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  },
);
