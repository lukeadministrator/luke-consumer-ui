import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { getAuthErrorMessage } from "../components/auth/authError";
import PageMeta from "../components/common/PageMeta";
import { Modal } from "../components/ui/modal";
import Button from "../components/ui/button/Button";
import Label from "../components/form/Label";
import Input from "../components/form/input/InputField";

type Plan = {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "/month",
    description: "For individuals getting started.",
    features: [
      "1 organization",
      "Up to 3 team members",
      "100 workflow runs / month",
      "Community support",
    ],
  },
  {
    id: "startup",
    name: "Startup",
    price: "$29.99",
    period: "/month",
    description: "For growing teams that need more.",
    popular: true,
    features: [
      "Everything in Free",
      "Unlimited team members",
      "10,000 workflow runs / month",
      "Priority email support",
      "Advanced scheduling & integrations",
    ],
  },
];

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 size-4 shrink-0 text-brand-500"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.5 7.6a1 1 0 0 1-1.424 0l-3.5-3.55a1 1 0 1 1 1.424-1.404l2.788 2.826 6.788-6.876a1 1 0 0 1 1.414-.006Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function CreateOrganization() {
  const navigate = useNavigate();
  const { createOrganization } = useAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [orgName, setOrgName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string>("free");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const openModal = () => {
    setStep(1);
    setIsOpen(true);
  };

  const handleCreate = async () => {
    setError("");
    setCreating(true);
    try {
      // Plan selection isn't billed yet; this creates the owner's tenant and
      // makes the user its admin, then routes into the app (now provisioned).
      await createOrganization({ name: orgName.trim() });
      setIsOpen(false);
      navigate("/dashboard");
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Create an Organization | Lukeflow"
        description="Create an Organization - Lukeflow, an orchestrator for a better future."
      />

      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-white px-4 text-center">
        <h1 className="text-2xl font-semibold text-gray-800 sm:text-3xl">
          Create an Organization
        </h1>
        {!isOpen && (
          <Button onClick={openModal}>Create Organization</Button>
        )}
      </div>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="mx-4 w-full max-w-[640px]"
      >
        <div className="p-6 sm:p-8">
          {/* Step indicator */}
          <div className="mb-6 flex items-center gap-2">
            <span
              className={`h-1.5 flex-1 rounded-full ${
                step >= 1 ? "bg-brand-500" : "bg-gray-200"
              }`}
            />
            <span
              className={`h-1.5 flex-1 rounded-full ${
                step >= 2 ? "bg-brand-500" : "bg-gray-200"
              }`}
            />
          </div>

          {step === 1 ? (
            <div>
              <p className="mb-1 text-sm font-medium text-brand-500">
                Step 1 of 2
              </p>
              <h2 className="mb-2 text-xl font-semibold text-gray-800">
                Name your organization
              </h2>
              <p className="mb-6 text-sm text-gray-500">
                This is how your organization will appear across Lukeflow.
              </p>

              <div>
                <Label>
                  Organization name <span className="text-error-500">*</span>
                </Label>
                <Input
                  name="orgName"
                  placeholder="Acme Inc."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>

              <div className="mt-8 flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!orgName.trim()}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-1 text-sm font-medium text-brand-500">
                Step 2 of 2
              </p>
              <h2 className="mb-2 text-xl font-semibold text-gray-800">
                Choose a plan
              </h2>
              <p className="mb-6 text-sm text-gray-500">
                Pick the plan that fits {orgName.trim() || "your organization"}.
                You can change this anytime.
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {PLANS.map((plan) => {
                  const selected = selectedPlan === plan.id;
                  return (
                    <button
                      type="button"
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative flex flex-col rounded-2xl border p-5 text-left transition-colors ${
                        selected
                          ? "border-brand-500 ring-1 ring-brand-500"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {plan.popular && (
                        <span className="absolute right-4 top-4 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-500">
                          Popular
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-700">
                        {plan.name}
                      </span>
                      <span className="mt-2 flex items-baseline gap-1">
                        <span className="text-2xl font-semibold text-gray-800">
                          {plan.price}
                        </span>
                        <span className="text-sm text-gray-500">
                          {plan.period}
                        </span>
                      </span>
                      <span className="mt-1 text-xs text-gray-500">
                        {plan.description}
                      </span>
                      <ul className="mt-4 space-y-2">
                        {plan.features.map((feature) => (
                          <li
                            key={feature}
                            className="flex gap-2 text-sm text-gray-600"
                          >
                            <CheckIcon />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              {error && (
                <div className="mt-6 rounded-lg border border-error-500 bg-error-50 px-4 py-3 text-sm text-error-600 dark:border-error-500/40 dark:bg-error-500/10 dark:text-error-400">
                  {error}
                </div>
              )}

              <div className="mt-8 flex items-center justify-between">
                <Button variant="outline" onClick={() => setStep(1)} disabled={creating}>
                  Back
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? "Creating…" : "Create organization"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
