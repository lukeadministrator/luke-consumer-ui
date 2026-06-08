import { Navigate, Outlet } from "react-router";
import { useAuth } from "../../context/AuthContext";

// Keeps already-authenticated users out of the auth pages (signin/signup).
export default function GuestRoute() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
