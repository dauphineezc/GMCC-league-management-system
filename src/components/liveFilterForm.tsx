"use client";

import { useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Param names whose empty / sentinel values should be omitted from the URL. */
  omitValues?: Record<string, string[]>;
};

/**
 * GET filter form that updates the URL as controls change (no Apply click).
 * Text inputs are debounced; selects/checkboxes apply immediately.
 */
export default function LiveFilterForm({
  children,
  className,
  omitValues = { approved: ["", "all"] },
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function syncFromForm(form: HTMLFormElement) {
    const fd = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of fd.entries()) {
      if (typeof value !== "string") continue;
      const omit = omitValues[key] ?? [""];
      if (omit.includes(value)) continue;
      params.append(key, value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <form
      method="GET"
      className={className}
      onChange={(e) => {
        const form = e.currentTarget;
        const el = e.target as HTMLElement;
        // Sport/division accordion navigates itself; ignore its events (and the manage panel).
        if (
          el.closest(".sport-division-accordion") ||
          el.closest(".sport-division-accordion__manage")
        ) {
          return;
        }

        const input = el as HTMLInputElement | HTMLSelectElement;
        const isText =
          input instanceof HTMLInputElement &&
          (input.type === "text" || input.type === "search" || !input.type);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (isText) {
          debounceRef.current = setTimeout(() => syncFromForm(form), 300);
        } else {
          syncFromForm(form);
        }
      }}
      onSubmit={(e) => {
        e.preventDefault();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        syncFromForm(e.currentTarget);
      }}
    >
      {children}
    </form>
  );
}
