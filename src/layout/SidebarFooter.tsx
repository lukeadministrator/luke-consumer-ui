import { useEffect, useRef } from "react";
import { Lock, LockOpen, Search } from "lucide-react";
import { useSidebar } from "../context/SidebarContext";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import NotificationDropdown from "../components/header/NotificationDropdown";
import UserDropdown from "../components/header/UserDropdown";

// The bottom cluster that replaces the old top navbar: search (⌘K), theme,
// notifications and the user menu — all of which open upward. Adapts between the
// collapsed icon rail and the expanded sidebar.
export default function SidebarFooter() {
  const { isExpanded, isHovered, isMobileOpen, setIsExpanded, toggleSidebar } = useSidebar();
  const expanded = isExpanded || isHovered || isMobileOpen;

  const inputRef = useRef<HTMLInputElement>(null);
  const wantFocus = useRef(false);

  // Focus the search input once the sidebar has expanded enough to render it.
  useEffect(() => {
    if (expanded && wantFocus.current) {
      wantFocus.current = false;
      inputRef.current?.focus();
    }
  }, [expanded]);

  const openSearch = () => {
    if (isExpanded || isHovered || isMobileOpen) {
      inputRef.current?.focus();
    } else {
      wantFocus.current = true;
      setIsExpanded(true);
    }
  };

  // ⌘K / Ctrl-K focuses search (expanding the rail first if needed).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, isHovered, isMobileOpen]);

  return (
    <div className="-mx-5 mt-auto shrink-0 border-t border-gray-200 px-3 pb-4 pt-3 dark:border-gray-800">
      {expanded ? (
        <div className="flex flex-col gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search or type command…"
              className="h-10 w-full rounded-lg border border-gray-200 bg-transparent pl-9 pr-12 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:text-white/90 dark:placeholder:text-white/30"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-0.5 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
              ⌘K
            </kbd>
          </div>

          {/* Theme + notifications + collapse */}
          <div className="flex items-center gap-2">
            <ThemeToggleButton />
            <NotificationDropdown placement="top" />
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={isExpanded ? "Unlock sidebar (allow collapse)" : "Lock sidebar open"}
              title={isExpanded ? "Locked open — click to unlock" : "Lock sidebar open"}
              className={`ml-auto hidden size-11 items-center justify-center rounded-full border transition lg:flex ${
                isExpanded
                  ? "border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-400"
                  : "border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {isExpanded ? <Lock className="size-5" /> : <LockOpen className="size-5" />}
            </button>
          </div>

          {/* User */}
          <UserDropdown placement="top" />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={openSearch}
            aria-label="Search"
            className="flex size-11 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Search className="size-5" />
          </button>
          <ThemeToggleButton />
          <NotificationDropdown placement="top" />
          <UserDropdown placement="top" compact />
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Lock sidebar open"
            title="Lock sidebar open"
            className="hidden size-11 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 lg:flex"
          >
            <LockOpen className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}
