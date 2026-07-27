"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { fullAppUrl, isEmbedded, openAppInNewTab } from "@/lib/embedAuth";

type EmbedSignInLinkProps = {
  href?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export default function EmbedSignInLink({
  href = "/login",
  className,
  style,
  children,
}: EmbedSignInLinkProps) {
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    setEmbedded(isEmbedded());
  }, []);

  if (embedded) {
    return (
      <a
        href={fullAppUrl(href)}
        className={className}
        style={style}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.preventDefault();
          openAppInNewTab(href);
        }}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} style={style}>
      {children}
    </Link>
  );
}
