import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { isAdmin } from "@/lib/utils";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, token } = useAuth();
  const location = useLocation();

  if (loading) {
    // If we already have a cached user, render the app immediately (avoid blank spinner).
    // The refresh in the background will reconcile silently.
    if (!user) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[color:var(--sc-bg)]">
          <div className="h-10 w-10 rounded-full border-4 border-[color:var(--sc-primary)] border-r-transparent animate-spin" />
        </div>
      );
    }
  }
  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (adminOnly && !isAdmin(user)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
