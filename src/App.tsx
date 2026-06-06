import { lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router";
import { ClerkProvider } from "@clerk/react";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import SsoCallback from "./pages/AuthPages/SsoCallback";
import ContinueSignUp from "./pages/AuthPages/ContinueSignUp";
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
import AuthPage from "./pages/Auth/AuthPage";
import CreateOrganization from "./pages/CreateOrganization";

// Code-split the form designer (builder + zod) to its own route chunk.
const FormBuilderPage = lazy(() => import("./pages/Forms/FormBuilderPage"));
import ProtectedRoute from "./components/auth/ProtectedRoute";
import GuestRoute from "./components/auth/GuestRoute";
import { SessionProvider } from "./context/SessionContext";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error(
    "Missing Clerk publishable key. Add VITE_CLERK_PUBLISHABLE_KEY to your .env.local file (get it from the Clerk dashboard)."
  );
}

// ClerkProvider must live inside the Router so it can drive SPA navigation
// through react-router instead of full-page reloads.
function ClerkWithRouter({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/signin"
      signUpUrl="/signup"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      afterSignOutUrl="/signin"
    >
      {children}
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <ClerkWithRouter>
        <SessionProvider>
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
              <Route path="/auth" element={<AuthPage />} />
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

          {/* OAuth redirect handler + missing-field continuation — kept
              outside the guards so they work mid-flow (no active session yet). */}
          <Route path="/sso-callback" element={<SsoCallback />} />
          <Route path="/signup/continue" element={<ContinueSignUp />} />

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </SessionProvider>
      </ClerkWithRouter>
    </Router>
  );
}
