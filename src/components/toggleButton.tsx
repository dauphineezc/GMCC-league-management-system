"use client";

import { CSSProperties } from "react";

type ToggleButtonProps = {
  isActive: boolean;
  activeLabel: string;
  inactiveLabel: string;
  activeColor?: string;
  inactiveColor?: string;
  activeBg?: string;
  inactiveBg?: string;
  activeCircleBg?: string;
  inactiveCircleBg?: string;
  minWidth?: string;
  variant?: "default" | "paid";
};

export default function ToggleButton({
  isActive,
  activeLabel,
  inactiveLabel,
  activeColor = "var(--green)",
  inactiveColor = "#ec720e",
  activeBg = "#EAF7EE",
  inactiveBg = "#FFF3E6",
  activeCircleBg = "var(--green)",
  inactiveCircleBg = "#ec720e",
  minWidth = "120px",
  variant = "default",
}: ToggleButtonProps) {
  const baseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "4px",
    padding: "4px",
    minWidth,
    border: "1px solid",
    borderColor: isActive ? activeColor : inactiveColor,
    borderRadius: "50px",
    background: isActive ? activeBg : inactiveBg,
    color: isActive ? activeColor : inactiveColor,
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.3s ease",
    position: "relative",
    margin: "0px",
  };

  return (
    <button
      type="submit"
      className={`toggle-button ${variant === "paid" ? "toggle-button--paid" : ""}`}
      aria-label={isActive ? `Mark as ${inactiveLabel.toLowerCase()}` : `Mark as ${activeLabel.toLowerCase()}`}
      title={isActive ? `Mark as ${inactiveLabel.toLowerCase()}` : `Mark as ${activeLabel.toLowerCase()}`}
      style={baseStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isActive
          ? "rgba(43, 139, 72, 0.25)"
          : "rgba(255, 144, 80, 0.25)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isActive ? activeBg : inactiveBg;
      }}
    >
      {isActive ? (
        <>
          <span className="toggle-button__label" style={{ flex: 1, textAlign: "left", fontSize: "14px", paddingLeft: "4px", alignSelf: "center" }}>{activeLabel}</span>
          <span
            className="toggle-button__circle"
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              background: activeCircleBg,
              flexShrink: 0,
            }}
          />
        </>
      ) : (
        <>
          <span
            className="toggle-button__circle"
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              background: inactiveCircleBg,
              flexShrink: 0,
            }}
          />
          <span className="toggle-button__label" style={{ flex: 1, textAlign: "right", fontSize: "14px", paddingRight: "4px", alignSelf: "center" }}>{inactiveLabel}</span>
        </>
      )}
    </button>
  );
}

