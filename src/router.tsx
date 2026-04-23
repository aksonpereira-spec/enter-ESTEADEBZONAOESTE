import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import StudentPortal from "./pages/StudentPortal";
import { ProtectedRoute } from "./components/ProtectedRoute";

export const routers = [
    {
      path: "/login",
      name: 'login',
      element: <Login />,
    },
    {
      path: "/",
      name: 'home',
      element: <ProtectedRoute requiredRole="admin"><Index /></ProtectedRoute>,
    },
    {
      path: "/portal",
      name: 'student-portal',
      element: <ProtectedRoute requiredRole="student"><StudentPortal /></ProtectedRoute>,
    },
    /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
    {
      path: "*",
      name: '404',
      element: <NotFound />,
    },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
