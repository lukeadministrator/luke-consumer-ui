import PageMeta from "../../components/common/PageMeta";

export default function Home() {
  return (
    <>
      <PageMeta
        title="Dashboard | Lukeflow"
        description="Dashboard - Lukeflow, an orchestrator for a better future."
      />
      <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center dark:border-gray-800 dark:bg-white/[0.03]">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90 sm:text-3xl">
          Welcome to Lukeflow
        </h1>
        <p className="mt-3 max-w-md text-sm text-gray-500 dark:text-gray-400">
          Your orchestrator for a better future. This is where your workflows
          and runs will live — start building from the menu.
        </p>
      </div>
    </>
  );
}
