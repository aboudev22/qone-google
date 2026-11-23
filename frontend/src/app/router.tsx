import { createBrowserRouter } from "react-router-dom";
import LandingPage from "../features/landing/LandingPage";
import { RegisterPage } from "../features/auth/RegisterPage";
import { LoginPage } from "../features/auth/LoginPage";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { AppLayout } from "../features/dashboard/AppLayout";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { ClientsPage } from "../features/crm/ClientsPage";
import { SalesPage } from "../features/sales/SalesPage";
import { TeamPage } from "../features/users/TeamPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { NotFoundPage } from "./NotFoundPage";
import { ErrorFallbackView } from "./ErrorPage";

export const router = createBrowserRouter([
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
        path: "clients",
        element: <ClientsPage />,
      },
      {
        path: "sales",
        element: <SalesPage />,
      },
      {
        path: "team",
        element: <TeamPage />,
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
]);
