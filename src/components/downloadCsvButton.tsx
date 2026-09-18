"use client";

type Props = {
  href: string;
  disabled?: boolean;
  disabledTitle?: string;
  label?: string;
};

/** Download CSV control; renders a muted non-link when disabled (e.g. PDF-only schedule). */
export default function DownloadCsvButton({
  href,
  disabled = false,
  disabledTitle = "CSV export is unavailable because only a schedule PDF is uploaded",
  label = "Download CSV",
}: Props) {
  if (disabled) {
    return (
      <span
        className="btn btn--outline btn--sm"
        aria-disabled="true"
        title={disabledTitle}
        style={{
          opacity: 0.45,
          cursor: "not-allowed",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {label}
      </span>
    );
  }

  return (
    <a className="btn btn--outline btn--sm" href={href}>
      {label}
    </a>
  );
}
