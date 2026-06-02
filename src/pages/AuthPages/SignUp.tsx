import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignUpForm from "../../components/auth/SignUpForm";

export default function SignUp() {
  return (
    <>
      <PageMeta
        title="Sign Up | Lukeflow"
        description="Sign Up - Lukeflow, an orchestrator for a better future."
      />
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </>
  );
}
