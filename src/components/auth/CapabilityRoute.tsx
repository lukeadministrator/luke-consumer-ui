import { Navigate, Outlet } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { canRead } from "../../lib/capabilities";

// Gates a resource behind a capability grant. Users without at least read access
// to `code` never reach the route (the sidebar link is hidden too); they're sent
// back to the dashboard rather than shown an empty/forbidden resource.
export default function CapabilityRoute({ code }: { code: string }) {
  const { session } = useAuth();

  if (!canRead(session, code)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
