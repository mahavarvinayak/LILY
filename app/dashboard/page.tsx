"use client";

import { AiAssistantView } from "@/components/app/ai-assistant-view";

/**
 * `/dashboard` is the conversation surface (see AGENTS.md). It used to bounce
 * straight to the stats page, which left the chat view unreachable.
 */
export default function DashboardPage() {
  return <AiAssistantView />;
}
