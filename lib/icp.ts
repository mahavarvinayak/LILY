export interface ClientIcpConfig {
  service_offer: string;
  target_geography: string;
  target_industry: string;
  company_size: string;
  decision_makers: string;
  buying_trigger: string;
  negative_filters: string;
  completed_at: string;
  completed: boolean;
}

export function parseIcpConfig(raw: string | null | undefined): ClientIcpConfig | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.completed === true &&
      typeof parsed.service_offer === "string" &&
      parsed.service_offer.trim().length > 0
    ) {
      return parsed as ClientIcpConfig;
    }
  } catch {}
  return null;
}

