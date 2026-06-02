import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useSignUp } from "@clerk/react/legacy";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import { getClerkErrorMessage } from "../../components/auth/clerkError";

type UpdatePayload = {
  username?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  phoneNumber?: string;
};

export default function ContinueSignUp() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<"details" | "verify">("details");
  const [values, setValues] = useState<Required<UpdatePayload>>({
    username: "",
    firstName: "",
    lastName: "",
    password: "",
    phoneNumber: "",
  });
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const missingFields: string[] = (isLoaded && signUp?.missingFields) || [];

  const finalize = useCallback(
    async (su: { status: string | null; createdSessionId: string | null }) => {
      if (su.status === "complete" && setActive) {
        await setActive({ session: su.createdSessionId });
        navigate("/", { replace: true });
        return true;
      }
      return false;
    },
    [setActive, navigate]
  );

  // If there's no sign-up in progress, there's nothing to continue.
  useEffect(() => {
    if (!isLoaded) return;
    if (!signUp || signUp.status === null) {
      navigate("/signup", { replace: true });
      return;
    }
    if (signUp.status === "complete") {
      finalize(signUp);
    }
  }, [isLoaded, signUp, navigate, finalize]);

  if (!isLoaded || !signUp) {
    return (
      <AuthLayout>
        <p className="text-center text-sm text-gray-500">Loading…</p>
      </AuthLayout>
    );
  }

  const set = (key: keyof UpdatePayload) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleDetails = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload: UpdatePayload = {};
      if (missingFields.includes("username")) payload.username = values.username;
      if (missingFields.includes("first_name"))
        payload.firstName = values.firstName;
      if (missingFields.includes("last_name"))
        payload.lastName = values.lastName;
      if (missingFields.includes("password")) payload.password = values.password;
      if (missingFields.includes("phone_number"))
        payload.phoneNumber = values.phoneNumber;

      const res = await signUp.update(payload);
      if (await finalize(res)) return;

      if (res.unverifiedFields?.includes("email_address")) {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setPhase("verify");
      } else {
        setError("Some required information is still missing.");
      }
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("Enter the verification code we emailed you.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await signUp.attemptEmailAddressVerification({ code });
      if (!(await finalize(res))) {
        setError("Invalid verification code. Please try again.");
      }
    } catch (err) {
      setError(getClerkErrorMessage(err, "Invalid verification code."));
    } finally {
      setLoading(false);
    }
  };

  const errorBanner = error && (
    <div className="rounded-lg border border-error-500 bg-error-50 px-4 py-3 text-sm text-error-600 dark:border-error-500/40 dark:bg-error-500/10 dark:text-error-400">
      {error}
    </div>
  );

  return (
    <>
      <PageMeta
        title="Complete sign up | Lukeflow"
        description="Finish creating your Lukeflow account."
      />
      <AuthLayout>
        <div className="flex flex-col w-full">
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              {phase === "verify" ? "Verify your email" : "Complete your sign up"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {phase === "verify"
                ? "Enter the code we emailed you to finish."
                : "Just a couple more details to finish creating your account."}
            </p>
          </div>

          {phase === "verify" ? (
            <form onSubmit={handleVerify}>
              <div className="space-y-5">
                {errorBanner}
                <div>
                  <Label>
                    Verification code <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    name="code"
                    placeholder="Enter the 6-digit code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
                <Button className="w-full" size="sm" disabled={loading}>
                  {loading ? "Verifying..." : "Verify email"}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleDetails}>
              <div className="space-y-5">
                {errorBanner}

                {missingFields.includes("username") && (
                  <div>
                    <Label>
                      Username <span className="text-error-500">*</span>
                    </Label>
                    <Input
                      name="username"
                      placeholder="Choose a username"
                      value={values.username}
                      onChange={set("username")}
                    />
                  </div>
                )}

                {missingFields.includes("first_name") && (
                  <div>
                    <Label>
                      First name <span className="text-error-500">*</span>
                    </Label>
                    <Input
                      name="firstName"
                      placeholder="Enter your first name"
                      value={values.firstName}
                      onChange={set("firstName")}
                    />
                  </div>
                )}

                {missingFields.includes("last_name") && (
                  <div>
                    <Label>
                      Last name <span className="text-error-500">*</span>
                    </Label>
                    <Input
                      name="lastName"
                      placeholder="Enter your last name"
                      value={values.lastName}
                      onChange={set("lastName")}
                    />
                  </div>
                )}

                {missingFields.includes("phone_number") && (
                  <div>
                    <Label>
                      Phone number <span className="text-error-500">*</span>
                    </Label>
                    <Input
                      name="phoneNumber"
                      placeholder="+1 555 000 0000"
                      value={values.phoneNumber}
                      onChange={set("phoneNumber")}
                    />
                  </div>
                )}

                {missingFields.includes("password") && (
                  <div>
                    <Label>
                      Password <span className="text-error-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        value={values.password}
                        onChange={set("password")}
                      />
                      <span
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                      >
                        {showPassword ? (
                          <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                        ) : (
                          <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                        )}
                      </span>
                    </div>
                  </div>
                )}

                <Button className="w-full" size="sm" disabled={loading}>
                  {loading ? "Finishing..." : "Continue"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </AuthLayout>
    </>
  );
}
