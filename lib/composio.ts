import { env, isComposioConfigured } from "@/lib/env";

export interface ConnectedMailbox {
  id: string;
  provider: "gmail" | "outlook" | "googlecalendar" | "custom_smtp";
  appName: string;
  email: string;
  status: "active" | "disconnected" | "expired";
  connectedAt: string;
}

interface ComposioAccount {
  id: string;
  appName?: string;
  toolkit?: { slug?: string; name?: string } | string;
  status?: string;
  created_at?: string;
  createdAt?: string;
  user_id?: string;
  params?: { email?: string };
  data?: { displayName?: string; status?: string };
  state?: { val?: { displayName?: string; status?: string } };
}

const DEFAULT_AUTH_CONFIGS: Record<string, string> = {
  gmail: "ac_CnNd-3JXO-N6",
  outlook: "ac_nub0TqwNpKjt",
  googlecalendar: "ac_SAKHhrlpEtrV",
};

async function resolveAuthConfigId(
  provider: "gmail" | "outlook" | "googlecalendar",
): Promise<string> {
  try {
    const res = await fetch("https://backend.composio.dev/api/v3/auth_configs", {
      headers: {
        "x-api-key": env.composioApiKey,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      const match = items.find((item: { toolkit?: { slug?: string; name?: string } }) => {
        const slug = item.toolkit?.slug?.toLowerCase() || item.toolkit?.name?.toLowerCase() || "";
        return slug === provider;
      });
      if (match?.auth_config?.id) return match.auth_config.id;
      if (match?.id) return match.id;
    }
  } catch {}
  return DEFAULT_AUTH_CONFIGS[provider] || "";
}

export async function initiateMailboxOAuth(
  entityId: string,
  provider: "gmail" | "outlook" | "googlecalendar",
  redirectUri: string,
): Promise<{ ok: boolean; redirectUrl?: string; error?: string }> {
  if (!isComposioConfigured()) {
    return {
      ok: true,
      redirectUrl: `${redirectUri}?composio_simulated=true&provider=${provider}`,
    };
  }

  try {
    const authConfigId = await resolveAuthConfigId(provider);
    if (!authConfigId) {
      return { ok: false, error: `Authentication config for ${provider} not found.` };
    }

    const res = await fetch("https://backend.composio.dev/api/v3/connected_accounts/link", {
      method: "POST",
      headers: {
        "x-api-key": env.composioApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: entityId,
        auth_config_id: authConfigId,
        callback_url: redirectUri,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message = err.error?.message || err.message || "Failed to initiate Composio OAuth.";
      return { ok: false, error: message };
    }

    const data = await res.json();
    const redirectUrl = data.redirect_url || data.link_url || data.redirectUrl || data.url;
    return { ok: true, redirectUrl };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Composio connection failed.",
    };
  }
}

export async function getConnectedMailboxes(entityId: string): Promise<ConnectedMailbox[]> {
  if (!isComposioConfigured() || !entityId) {
    return [];
  }

  try {
    const res = await fetch(
      `https://backend.composio.dev/api/v3/connected_accounts?user_ids=${encodeURIComponent(entityId)}&user_id=${encodeURIComponent(entityId)}`,
      {
        headers: {
          "x-api-key": env.composioApiKey,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(12000),
      },
    );

    if (!res.ok) return [];
    const data: unknown = await res.json();
    const rawItems =
      data && typeof data === "object" && "items" in data
        ? (data as { items?: unknown }).items
        : Array.isArray(data)
          ? data
          : undefined;
    const items = Array.isArray(rawItems) ? (rawItems as ComposioAccount[]) : [];

    return items
      .filter((item) => {
        const itemUserId = item.user_id || (item as { userId?: string }).userId;
        if (!itemUserId || itemUserId !== entityId) {
          return false;
        }
        const rawToolkit = typeof item.toolkit === "object" ? item.toolkit?.slug : item.toolkit;
        const name = (item.appName || rawToolkit || "").toLowerCase();
        return name.includes("gmail") || name.includes("outlook");
      })
      .map((item) => {
        const rawToolkit = typeof item.toolkit === "object" ? item.toolkit?.slug : item.toolkit;
        const name = (item.appName || rawToolkit || "").toLowerCase();
        const provider = name.includes("outlook") ? ("outlook" as const) : ("gmail" as const);
        const email =
          item.data?.displayName ||
          item.state?.val?.displayName ||
          item.params?.email ||
          (item.user_id?.includes("@") ? item.user_id : "Connected Inbox");
        const status = item.status?.toUpperCase() === "ACTIVE" ? ("active" as const) : ("disconnected" as const);

        return {
          id: item.id,
          provider,
          appName: provider,
          email,
          status,
          connectedAt: item.created_at || item.createdAt || new Date().toISOString(),
        };
      });
  } catch {
    return [];
  }
}

export async function disconnectMailbox(accountId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isComposioConfigured()) {
    return { ok: true };
  }

  try {
    const res = await fetch(`https://backend.composio.dev/api/v3/connected_accounts/${encodeURIComponent(accountId)}`, {
      method: "DELETE",
      headers: {
        "x-api-key": env.composioApiKey,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.message || "Failed to disconnect account." };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to disconnect account.",
    };
  }
}

export async function sendComposioOutreach(
  entityId: string,
  payload: { to: string; subject: string; body: string; provider?: "gmail" | "outlook" },
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!isComposioConfigured()) {
    return { ok: true, messageId: `sim-${Date.now()}` };
  }

  const toolSlug = payload.provider === "outlook" ? "OUTLOOK_SEND_MAIL" : "GMAIL_SEND_EMAIL";
  const parameters =
    payload.provider === "outlook"
      ? { to_recipients: [payload.to], subject: payload.subject, body: payload.body }
      : { recipient_email: payload.to, subject: payload.subject, body: payload.body };

  try {
    const res = await fetch(`https://backend.composio.dev/api/v3/tools/execute/${toolSlug}`, {
      method: "POST",
      headers: {
        "x-api-key": env.composioApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: entityId,
        arguments: parameters,
        dangerouslySkipVersionCheck: true,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message = err.error?.message || err.message || "Failed to dispatch via Composio.";
      return { ok: false, error: message };
    }

    const result = await res.json();
    return { ok: true, messageId: result.data?.id || result.executionId || result.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Composio dispatch failed.",
    };
  }
}
