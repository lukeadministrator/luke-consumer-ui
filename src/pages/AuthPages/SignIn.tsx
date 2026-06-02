import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Sign In | Lukeflow"
        description="Sign In - Lukeflow, an orchestrator for a better future."
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
