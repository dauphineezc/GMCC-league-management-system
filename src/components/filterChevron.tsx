/** Shared caret matching styled `select.input` filters. */
export default function FilterChevron({
  direction = "down",
  className,
}: {
  direction?: "down" | "up" | "right";
  className?: string;
}) {
  const rotation =
    direction === "up" ? 180 : direction === "right" ? -90 : 0;

  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        display: "block",
        flexShrink: 0,
      }}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
