import PageMeta from "../../components/common/PageMeta";
import { MailIcon } from "../../icons";

export default function Email() {
  return (
    <>
      <PageMeta
        title="Email | Lukeflow"
        description="Email - Lukeflow, an orchestrator for a better future."
      />
      <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center dark:border-gray-800 dark:bg-white/[0.03]">
        <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/10">
          <MailIcon className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold text-gray-800 dark:text-white/90 sm:text-3xl">
          Email
        </h1>
        <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
          Compose and manage emails for your orchestrations here.
        </p>
      </div>
    </>
  );
}
