"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface CompanyFaviconProps {
  domain?: string | null;
  website?: string | null;
  name?: string;
  size?: number;
  className?: string;
}

export function CompanyFavicon({
  domain,
  website,
  name = "Company",
  size = 28,
  className,
}: CompanyFaviconProps) {
  const [error, setError] = useState(false);

  let cleanDomain = domain?.trim();
  if (!cleanDomain && website) {
    try {
      const parsed = new URL(
        website.startsWith("http") ? website : `https://${website}`,
      );
      cleanDomain = parsed.hostname.replace(/^www\./, "");
    } catch {
      cleanDomain = "";
    }
  }

  const initial = (name.trim()[0] || "C").toUpperCase();

  if (!cleanDomain || error) {
    return (
      <div
        style={{ width: size, height: size }}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 font-mono text-xs font-semibold text-primary",
          className,
        )}
      >
        {initial}
      </div>
    );
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`;

  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      <Image
        src={faviconUrl}
        alt={name}
        width={size}
        height={size}
        className="size-full object-contain p-0.5"
        onError={() => setError(true)}
        unoptimized
      />
    </div>
  );
}
