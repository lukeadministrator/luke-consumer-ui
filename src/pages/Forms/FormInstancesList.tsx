import PageMeta from "../../components/common/PageMeta";
import { useAuth } from "../../context/AuthContext";
import InstancesPanel from "./InstancesPanel";

// Standalone "all submissions across every form" view.
export default function FormInstancesList() {
  const { session } = useAuth();
  const tenant = session?.tenant ?? null;
  if (!tenant) return null;

  return (
    <>
      <PageMeta title="Form Instances | Lukeflow" description="Form submissions and their processes." />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Form Instances</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Submissions across your forms, and what happened to each.</p>
      </div>
      <InstancesPanel tenant={tenant} />
    </>
  );
}
