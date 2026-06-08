import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router";
import { AuthProvider } from "./context/AuthContext";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import SsoCallback from "./pages/AuthPages/SsoCallback";
import NotFound from "./pages/OtherPage/NotFound";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import FormsList from "./pages/Forms/FormsList";
import Email from "./pages/Email/Email";
import Phone from "./pages/Phone/Phone";
import Profile from "./pages/Account/Profile";
import Settings from "./pages/Account/Settings";
import Support from "./pages/Support/Support";
import CreateOrganization from "./pages/CreateOrganization";

// Code-split the form designer (builder + zod) to its own route chunk.
const FormBuilderPage = lazy(() => import("./pages/Forms/FormBuilderPage"));
import ProtectedRoute from "./components/auth/ProtectedRoute";
import GuestRoute from "./components/auth/GuestRoute";

if (!import.meta.env.VITE_AUTH_API_URL) {
  throw new Error(
    "Missing VITE_AUTH_API_URL. Point it at the luke-auth-engine base URL in your .env.local.",
  );
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <AuthProvider>
        <Routes>
          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            {/* Landing after login: full-screen onboarding, no app shell */}
            <Route index path="/" element={<CreateOrganization />} />

            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Home />} />
              <Route path="/forms" element={<FormsList />} />
              <Route path="/email" element={<Email />} />
              <Route path="/phone" element={<Phone />} />
              <Route path="/account/profile" element={<Profile />} />
              <Route path="/account/settings" element={<Settings />} />
              <Route path="/support" element={<Support />} />

              {/* Form designer — lives in the normal dashboard shell. */}
              <Route
                path="/forms/:id"
                element={
                  <Suspense
                    fallback={
                      <div className="flex h-[60vh] items-center justify-center text-sm text-gray-400">
                        Loading designer…
                      </div>
                    }
                  >
                    <FormBuilderPage />
                  </Suspense>
                }
              />
            </Route>
          </Route>

          {/* Auth pages (only for signed-out users) */}
          <Route element={<GuestRoute />}>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
          </Route>

          {/* Social / SSO redirect handler — outside the guards (no session yet). */}
          <Route path="/sso-callback" element={<SsoCallback />} />

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
