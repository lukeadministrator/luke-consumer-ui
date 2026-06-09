import { Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import CreateOrganization from "../../pages/CreateOrganization";

// The landing route ("/"). A brand-new user (authenticated but not yet onboarded
// to the engine) gets the create-organization flow; an already-provisioned user
// is sent straight into the app instead of being asked to create an org again.
export default function OnboardingGate() {
  const { session } = useAuth();

  if (session?.provisioned) {
    return <Navigate to="/dashboard" replace />;
  }
  return <CreateOrganization />;
}
