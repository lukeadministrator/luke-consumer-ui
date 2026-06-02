import { Navigate, Outlet } from "react-router";
import { useAuth } from "@clerk/react";

// Keeps already-authenticated users out of the auth pages (signin/signup),
// redirecting them to the landing page instead.
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
