"use client";

import { Suspense } from "react";
import { ConnectorsPage } from "@/components/app/connectors-page";

export const dynamic = "force-dynamic";

export default function DashboardConnectorsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-muted-foreground">Loading connectors…</div>}>
      <ConnectorsPage />
    </Suspense>
  );
}
