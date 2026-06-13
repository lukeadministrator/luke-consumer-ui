import { Info } from "lucide-react";

/**
 * Small info icon shown next to a field label. Reveals the field's `tooltip`
 * text on hover and on keyboard focus. Used by both the builder canvas and the
 * form renderer so the look stays consistent.
 */
export default function FieldTooltip({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <span className="group/tt relative ml-1 inline-flex align-middle">
      <button
        type="button"
        aria-label={text}
        onClick={(e) => e.preventDefault()}
        className="inline-flex cursor-help text-gray-400 transition hover:text-gray-600 focus:text-gray-600 focus:outline-none dark:text-gray-500 dark:hover:text-gray-300"
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden w-max max-w-xs -translate-x-1/2 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-normal leading-snug text-white shadow-lg group-hover/tt:block group-focus-within/tt:block dark:bg-gray-700"
      >
        {text}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
      </span>
    </span>
  );
}
