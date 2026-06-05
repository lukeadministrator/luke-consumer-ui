import { ReactNode } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: "top" | "bottom";
  className?: string;
}

/**
 * Lightweight hover/focus tooltip. Wrap any trigger element; the bubble shows
 * on hover or keyboard focus of the wrapper's contents.
 */
export default function Tooltip({
  content,
  children,
  position = "bottom",
  className = "",
}: TooltipProps) {
  return (
    <span className={`group/tooltip relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-[100] w-max max-w-[16rem] -translate-x-1/2 scale-95 rounded-lg bg-gray-900 px-3 py-2 text-left text-xs font-normal leading-relaxed text-white opacity-0 shadow-theme-lg transition duration-150 group-hover/tooltip:scale-100 group-hover/tooltip:opacity-100 group-focus-within/tooltip:scale-100 group-focus-within/tooltip:opacity-100 dark:bg-gray-700 ${
          position === "top" ? "bottom-full mb-2" : "top-full mt-2"
        }`}
      >
        {content}
      </span>
    </span>
  );
}
