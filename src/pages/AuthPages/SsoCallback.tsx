import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";

// Finishes the Google / Microsoft social handshake. luke-auth's /auth/callback
// set the refresh cookie and redirected here; we restore the session from it.
export default function SsoCallback() {
  const { completeFromToken } = useAuth();
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    completeFromToken()
      .then((ok) => navigate(ok ? "/" : "/signin", { replace: true }))
      .catch(() => navigate("/signin", { replace: true }));
  }, [completeFromToken, navigate]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white text-sm text-gray-500">
      Completing sign-in…
    </div>
  );
}
