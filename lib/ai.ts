import dns from "node:dns";
import { env, isGroqConfigured, isZaiConfigured } from "@/lib/env";
import { synthesizeDefaultPitch } from "@/lib/intelligence";

try {
  dns.setDefaultResultOrder?.("ipv4first");
} catch {}

export interface DraftLead {
  id: string;
  company: string;
  person: string;
  role: string;
  trigger: string;
  dealName: string;
}

export interface Draft {
  id: string;
  subject: string;
  body: string;
}

function fallbackDraft(lead: DraftLead): Draft {
  const pitch = synthesizeDefaultPitch(lead.company, lead.person, lead.trigger);
  return {
    id: lead.id,
    subject: pitch.emailSubject,
    body: pitch.emailBody,
  };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const payload = fenced?.[1] ?? trimmed;
  const start = payload.indexOf("{");
  const end = payload.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(payload.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callOpenAICompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPayload: unknown,
  timeoutMs = 25000,
  jsonMode = true,
  maxTokens = 900,
) {
  const maxRetries = model === "glm-4.7-flash" ? 2 : 1;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const bodyPayload: Record<string, unknown> = {
        model,
        temperature: 0.35,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: typeof userPayload === "string" ? userPayload : JSON.stringify(userPayload) },
        ],
      };

      if (jsonMode) {
        bodyPayload.response_format = { type: "json_object" };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const payload = (await response.json().catch(() => null)) as {
        choices?: { message?: { content?: string } }[];
        error?: { code?: string | number; message?: string };
      } | null;

      if (response.ok) {
        return payload?.choices?.[0]?.message?.content ?? "";
      }

      const errCode = String(payload?.error?.code ?? "");
      const isOverloaded = response.status === 429 || errCode === "1305";

      if (isOverloaded && attempt < maxRetries) {
        const delay = 650 * (attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(`LLM call failed with status ${response.status} code ${errCode}`);
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      // AbortSignal.timeout() rejects with a DOMException named "TimeoutError",
      // not "AbortError".
      if (attempt < maxRetries && (error?.name === "AbortError" || error?.name === "TimeoutError")) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        continue;
      }
      if (attempt === maxRetries) {
        throw err;
      }
    }
  }

  return "";
}

async function callWithModelFallback(
  endpoint: string,
  apiKeys: string[],
  models: string[],
  systemPrompt: string,
  userPayload: unknown,
  timeoutMs = 20000,
  maxTokens = 900,
): Promise<string> {
  const keys = Array.from(new Set(apiKeys.filter(Boolean)));
  if (keys.length === 0) return "";

  const candidates = Array.from(new Set(models.filter(Boolean)));

  for (const model of candidates) {
    for (const key of keys) {
      try {
        const content = await callOpenAICompatible(
          endpoint,
          key,
          model,
          systemPrompt,
          userPayload,
          timeoutMs,
          true,
          maxTokens,
        );
        if (content) return content;
      } catch {
        continue;
      }
    }
  }

  return "";
}

const DRAFT_SYSTEM_PROMPT =
  "You write high-converting B2B cold outreach for a boutique tech and revenue infrastructure agency. For each lead, return a specific subject line (max 7 words, no clickbait) and a 3-sentence email body (max 60 words). Sentence 1: hook referencing their exact hiring or expansion trigger without scraper tokens. Sentence 2: concrete value proposition (solving the 6-to-8 week hiring lag with instant vetted engineering or growth pods). Sentence 3: one low-friction ask (e.g. 'Worth a 4-minute chat this Thursday?'). No flattery, no 'hope you are well', no emojis, no bullet points, no invented facts. Write like a top-tier peer operator. Return strict JSON: {\"drafts\":[{\"id\":\"...\",\"subject\":\"...\",\"body\":\"...\"}]}";

/** Small batches keep the JSON response inside the token budget. */
const DRAFT_CHUNK_SIZE = 8;

async function draftChunk(leads: DraftLead[]): Promise<Draft[]> {
  const fallback = leads.map(fallbackDraft);

  const userPayload = {
    leads: leads.map((lead) => ({
      id: lead.id,
      company: lead.company,
      contact: lead.person,
      role: lead.role,
      deal: lead.dealName,
      trigger: lead.trigger,
    })),
  };

  const maxTokens = Math.min(4000, Math.max(900, leads.length * 220));
  let content = "";

  if (isZaiConfigured()) {
    const endpoint = `${env.zaiBaseUrl}/chat/completions`;
    content = await callWithModelFallback(
      endpoint,
      [env.zaiApiKeyFast, env.zaiApiKeyHeavy],
      ["glm-4.5-flash", "glm-4.7-flash"],
      DRAFT_SYSTEM_PROMPT,
      userPayload,
      32000,
      maxTokens,
    );
  }

  if (!content && isGroqConfigured()) {
    try {
      content = await callOpenAICompatible(
        "https://api.groq.com/openai/v1/chat/completions",
        env.groqApiKey,
        env.groqModel,
        DRAFT_SYSTEM_PROMPT,
        userPayload,
        15000,
        true,
        maxTokens,
      );
    } catch {}
  }

  if (!content) return fallback;

  const parsed = extractJson(content) as { drafts?: unknown } | null;
  if (!parsed || !Array.isArray(parsed.drafts)) return fallback;

  const byId = new Map<string, { subject: string; body: string }>();
  for (const draft of parsed.drafts) {
    if (!draft || typeof draft !== "object") continue;
    const record = draft as { id?: unknown; subject?: unknown; body?: unknown };
    if (typeof record.id !== "string") continue;
    byId.set(record.id, {
      subject: String(record.subject ?? "").slice(0, 140).trim(),
      body: String(record.body ?? "").slice(0, 900).trim(),
    });
  }

  return leads.map((lead) => {
    const generated = byId.get(lead.id);
    const base = fallback.find((draft) => draft.id === lead.id) ?? fallbackDraft(lead);
    return {
      id: lead.id,
      subject: generated?.subject || base.subject,
      body: generated?.body || base.body,
    };
  });
}

export async function generateDrafts(leads: DraftLead[]): Promise<Draft[]> {
  if (leads.length === 0) return [];

  const results: Draft[] = [];
  for (let index = 0; index < leads.length; index += DRAFT_CHUNK_SIZE) {
    const chunk = leads.slice(index, index + DRAFT_CHUNK_SIZE);
    results.push(...(await draftChunk(chunk)));
  }
  return results;
}
