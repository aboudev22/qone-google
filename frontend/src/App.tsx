import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./features/auth/AuthContext";
import { AppErrorBoundary } from "./app/ErrorPage";
import { router } from "./app/router";

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </AppErrorBoundary>
  );
}
