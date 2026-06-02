import { useEffect, useRef } from "react";
import { useClerk } from "@clerk/react";
import { useNavigate } from "react-router";

// Finishes the Google / X OAuth handshake. If the resulting sign-up still needs
// fields the provider didn't supply, Clerk routes to our own /signup/continue
// page (continueSignUpUrl) instead of the hosted Account Portal.
export default function SsoCallback() {
  const clerk = useClerk();
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    clerk
      .handleRedirectCallback({
        signInFallbackRedirectUrl: "/",
        signUpFallbackRedirectUrl: "/",
        continueSignUpUrl: "/signup/continue",
      })
      .catch(() => {
        navigate("/signin", { replace: true });
      });
  }, [clerk, navigate]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white text-sm text-gray-500">
      Completing sign-in…
    </div>
  );
}
