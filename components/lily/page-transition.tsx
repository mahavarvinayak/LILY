"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * Fade/slide only — no `filter`. A `filter` on this wrapper creates a
 * containing block, which breaks `position: fixed` and `position: sticky`
 * descendants (the site nav would scroll away with the page).
 */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  return (
    <motion.div
      key={pathname}
      className={className}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
