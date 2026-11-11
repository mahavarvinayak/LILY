export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqModel: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
  zaiApiKeyFast: process.env.ZAI_API_KEY_FAST ?? process.env.ZAI_API_KEY ?? "",
  zaiApiKeyHeavy: process.env.ZAI_API_KEY_HEAVY ?? process.env.ZAI_API_KEY ?? "",
  zaiBaseUrl: process.env.ZAI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
  composioApiKey: process.env.COMPOSIO_API_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "LILY <outreach@lily.os>",
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://lily-dusky.vercel.app",
};

export function isSupabaseConfigured() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function isGroqConfigured() {
  return Boolean(env.groqApiKey);
}

export function isZaiConfigured() {
  return Boolean(env.zaiApiKeyFast || env.zaiApiKeyHeavy);
}

export function isComposioConfigured() {
  return Boolean(env.composioApiKey);
}

export function isResendConfigured() {
  return Boolean(env.resendApiKey);
}

export function isDemoMode() {
  return process.env.NODE_ENV !== "production" && process.env.DEMO_MODE === "1";
}
