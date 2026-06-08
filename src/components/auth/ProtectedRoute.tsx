import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../../context/AuthContext";

// Gates the app behind authentication. Unauthenticated users are sent to
// /signin, remembering where they were headed so we can return them there.
export default function ProtectedRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  // Wait for the initial session check before deciding, to avoid a redirect flash.
  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
