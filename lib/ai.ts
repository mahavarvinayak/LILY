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
) {
  const maxRetries = model === "glm-4.7-flash" ? 2 : 1;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const bodyPayload: Record<string, unknown> = {
        model,
        temperature: 0.35,
        max_tokens: 900,
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
      if (attempt < maxRetries && error?.name === "AbortError") {
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
        );
        if (content) return content;
      } catch {
        continue;
      }
    }
  }

  return "";
}

export async function generateDrafts(leads: DraftLead[]): Promise<Draft[]> {
  if (leads.length === 0) return [];
  const fallback = leads.map(fallbackDraft);

  const systemPrompt =
    "You write high-converting B2B cold outreach for a boutique tech and revenue infrastructure agency. For each lead, return a specific subject line (max 7 words, no clickbait) and a 3-sentence email body (max 60 words). Sentence 1: hook referencing their exact hiring or expansion trigger without scraper tokens. Sentence 2: concrete value proposition (solving the 6-to-8 week hiring lag with instant vetted engineering or growth pods). Sentence 3: one low-friction ask (e.g. 'Worth a 4-minute chat this Thursday?'). No flattery, no 'hope you are well', no emojis, no bullet points, no invented facts. Write like a top-tier peer operator. Return strict JSON: {\"drafts\":[{\"id\":\"...\",\"subject\":\"...\",\"body\":\"...\"}]}";

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

  let content = "";

  if (isZaiConfigured()) {
    const endpoint = `${env.zaiBaseUrl}/chat/completions`;
    content = await callWithModelFallback(
      endpoint,
      [env.zaiApiKeyFast, env.zaiApiKeyHeavy],
      ["glm-4.5-flash", "glm-4.7-flash"],
      systemPrompt,
      userPayload,
      32000,
    );
  }

  if (!content && isGroqConfigured()) {
    try {
      content = await callOpenAICompatible(
        "https://api.groq.com/openai/v1/chat/completions",
        env.groqApiKey,
        env.groqModel,
        systemPrompt,
        userPayload,
        15000,
      );
    } catch {}
  }

  if (!content) return fallback;

  const parsed = extractJson(content) as { drafts?: unknown } | null;
  if (!parsed || !Array.isArray(parsed.drafts)) return fallback;

  const byId = new Map(
    (parsed.drafts as { id?: string; subject?: string; body?: string }[])
      .filter((draft) => typeof draft.id === "string")
      .map((draft) => [
        draft.id as string,
        {
          subject: String(draft.subject ?? "").slice(0, 140).trim(),
          body: String(draft.body ?? "").slice(0, 900).trim(),
        },
      ]),
  );

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

const OFF_TOPIC_REGEX =
  /\b(poem|poetry|story|recipe|cooking|homework|essay|write a song|solve this math|calculus|algebra|physics|biology|who is the president|movie review|video game|dating advice|relationship|fiction|joke|riddle|translate to french|translate to spanish|crypto price|weather today|horoscope|astrology)\b/i;

export function checkB2BScope(prompt: string): { allowed: boolean; refusal?: string } {
  const clean = prompt.trim().toLowerCase();
  if (OFF_TOPIC_REGEX.test(clean)) {
    return {
      allowed: false,
      refusal:
        "Token Guard: I am LILY's specialized B2B Deal-Closing & Pipeline Copilot. I only assist with B2B cold outreach, LinkedIn follow-ups, objection handling, and pipeline conversion to protect your agency token allocation.",
    };
  }
  return { allowed: true };
}

export async function agentReply(
  prompt: string,
  context: { agencyName: string; newLeads: number; pipelineValue: number; stages: Record<string, number> },
  modelPreference?: "glm-4.7-flash" | "glm-4.5-flash",
): Promise<{ message: string; filter?: string } | null> {
  const scope = checkB2BScope(prompt);
  if (!scope.allowed) {
    return { message: scope.refusal! };
  }

  const systemPrompt =
    "You are LILY, an elite B2B sales copilot and deal closer for digital marketing and lead-gen agencies. You strictly write and advise on: cold email pitches (< 50 words pain-led), LinkedIn connection DMs, B2B objection handling, follow-up cadences, and agency pipeline strategies. If the user asks for something outside B2B sales, decline politely. Return clean JSON: {\"message\": \"Markdown formatted reply\", \"filter\": \"optional company or stage filter keyword\"}";

  const userPayload = { prompt, context };
  let content = "";

  if (isZaiConfigured()) {
    const preferred =
      modelPreference ??
      (prompt.includes("draft") || prompt.includes("sequence")
        ? "glm-4.7-flash"
        : "glm-4.5-flash");
    const cascade = preferred === "glm-4.7-flash"
      ? ["glm-4.7-flash", "glm-4.5-flash"]
      : ["glm-4.5-flash", "glm-4.7-flash"];
    const endpoint = `${env.zaiBaseUrl}/chat/completions`;

    content = await callWithModelFallback(
      endpoint,
      [env.zaiApiKeyFast, env.zaiApiKeyHeavy],
      cascade,
      systemPrompt,
      userPayload,
      20000,
    );
  }

  if (!content && isGroqConfigured()) {
    try {
      content = await callOpenAICompatible(
        "https://api.groq.com/openai/v1/chat/completions",
        env.groqApiKey,
        env.groqModel,
        systemPrompt,
        userPayload,
        12000,
      );
    } catch {}
  }

  if (!content) return null;

  const parsed = extractJson(content) as { message?: string; filter?: string } | null;
  if (!parsed?.message) return null;
  return {
    message: parsed.message,
    filter: parsed.filter?.trim() || undefined,
  };
}
