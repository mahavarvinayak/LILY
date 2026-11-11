"use client";

import { nameFromEmail } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUp, Copy, Plus } from "lucide-react";
import { workspaceQuery } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { LilyMark } from "@/components/lily/lily-mark";
import { toast } from "sonner";

type Message = { role: "user" | "assistant"; content: string };

function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-3">
      {text.split("\n").map((line, index) => (
        <p key={index} className="min-h-2 whitespace-pre-wrap">
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
            part.startsWith("**") ? (
              <strong key={i} className="font-semibold text-foreground">
                {part.slice(2, -2)}
              </strong>
            ) : (
              part
            ),
          )}
        </p>
      ))}
    </div>
  );
}

export function AiAssistantView() {
  const { data: workspace } = useSuspenseQuery(workspaceQuery());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const top = [...workspace.opportunities]
    .filter((lead) => !["Customer", "Lost"].includes(lead.stage))
    .sort((a, b) => b.deal_value - a.deal_value)[0];

  const prompts = top
    ? [
        `Draft a pain-led email for ${top.company?.name ?? top.deal_name}`,
        `Plan a 3-touch follow-up for ${top.company?.name ?? top.deal_name}`,
        `Summarize my ${workspace.opportunities.length} released opportunities`,
      ]
    : [
        "What makes a strong buying trigger?",
        "Help me prepare my first outreach cadence",
        "How should I qualify a new opportunity?",
      ];

  async function send(override?: string) {
    const text = (override ?? input).trim();
    if (!text || busy) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: text,
          modelPreference: "glm-4.7-flash",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not reach LILY Intelligence.");
      }

      setMessages([
        ...next,
        {
          role: "assistant",
          content: data.message || data.text || "Command processed.",
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach LILY.");
      setInput(text);
    } finally {
      setBusy(false);
    }
  }

  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(new Date()),
  );
  const greet =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const empty = !messages.length;

  const composer = (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
      className={
        "glass w-full rounded-3xl border border-primary/20 p-4 shadow-soft transition focus-within:border-primary/50 focus-within:shadow-glow " +
        (empty ? "" : "sticky bottom-4 mt-auto")
      }
    >
      <label htmlFor="copilot-prompt" className="sr-only">
        Message LILY
      </label>
      <textarea
        id="copilot-prompt"
        autoFocus
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void send();
          }
        }}
        rows={empty ? 3 : 2}
        maxLength={8000}
        placeholder="How can LILY help your pipeline today?"
        className="w-full resize-none bg-transparent text-[15px] leading-7 outline-none placeholder:text-muted-foreground/70"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] text-muted-foreground">
          LILY Intelligence · Private Workspace Pipeline
        </span>
        <div className="flex items-center gap-2">
          {!empty && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="New chat"
              disabled={busy}
              onClick={() => {
                setMessages([]);
                setError("");
              }}
            >
              <Plus className="size-4" />
            </Button>
          )}
          <Button
            type="submit"
            size="icon"
            aria-label="Send message"
            disabled={busy || !input.trim()}
            className="rounded-full"
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
      </div>
    </form>
  );

  if (empty) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-3xl flex-col items-center justify-center py-10 text-center">
        <div className="mb-6 grid size-16 animate-pulse-soft place-items-center rounded-full border border-primary/20 bg-primary/10 shadow-glow">
          <LilyMark className="size-8 text-primary" />
        </div>
        <h1 className="font-display text-4xl sm:text-5xl">
          {greet},{" "}
          <em className="text-primary not-italic">
            {nameFromEmail(workspace.profile.contact_email) ||
              workspace.profile.agency_name}
            .</em>
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          {workspace.opportunities.length} deals · {workspace.companies.length}{" "}
          companies · next drop 08:00 IST
        </p>
        <div className="mt-9 w-full text-left">{composer}</div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => void send(prompt)}
              className="rounded-full border border-border bg-surface/60 px-4 py-2 text-xs text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary motion-reduce:transform-none"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-[calc(100dvh-10rem)] max-w-3xl flex-col pb-6">
      <div className="space-y-7 py-4" role="log" aria-label="Conversation">
        {messages.map((message, index) => (
          <article
            key={index}
            className={
              message.role === "user"
                ? "ml-auto max-w-[85%] rounded-3xl rounded-br-md border border-primary/20 bg-primary/10 p-5 text-sm leading-7"
                : "glass mr-auto max-w-[95%] rounded-3xl rounded-bl-md border border-border p-6 text-sm leading-7"
            }
          >
            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {message.role === "user" ? "You" : "LILY · Intelligence"}
            </p>
            <Markdown text={message.content} />
            {message.role === "assistant" && (
              <button
                aria-label="Copy response"
                className="mt-4 text-muted-foreground hover:text-primary"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(message.content)
                    .then(() => toast.success("Copied."))
                    .catch(() => toast.error("Clipboard unavailable."));
                }}
              >
                <Copy className="size-4" />
              </button>
            )}
          </article>
        ))}
      </div>
      {busy && (
        <div role="status" className="glass mb-6 rounded-2xl border border-border p-5">
          <span className="flex items-center gap-2 text-sm text-primary">
            <LilyMark className="size-4 animate-spin" />
            LILY is synthesizing pipeline intelligence…
          </span>
          <div className="mt-3 h-1 w-2/3 animate-shimmer rounded-full bg-primary/20" />
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div ref={bottom} />
      {composer}
    </div>
  );
}
