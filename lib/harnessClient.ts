// Live ADK harness client — POSTs to the FastAPI server and parses SSE events.

import { getApiKey, getHarnessUrl } from "./harness";
import type { Trace, TraceStep } from "./types";

export interface LiveTraceCallbacks {
  onStep: (step: TraceStep) => void;
  onSummary: (summary: {
    durationMs: number;
    guardrailsFired: string[];
    finalResponse: string;
    sessionId?: string;
  }) => void;
  onError: (message: string) => void;
}

export async function runLiveTrace(
  transcript: string,
  opts: { authenticated: boolean; memberId?: string; sessionId?: string },
  cb: LiveTraceCallbacks
): Promise<void> {
  const url = getHarnessUrl();
  if (!url) {
    cb.onError("Harness URL not configured (NEXT_PUBLIC_HARNESS_URL).");
    return;
  }
  const key = getApiKey();
  if (!key) {
    cb.onError("Set your Gemini API key in Settings (gear icon, lower-left).");
    return;
  }

  const resp = await fetch(`${url}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gemini-Key": key,
    },
    body: JSON.stringify({
      transcript,
      authenticated: opts.authenticated,
      member_id: opts.memberId ?? null,
      session_id: opts.sessionId ?? null,
    }),
  });

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => "");
    cb.onError(`Harness returned ${resp.status}: ${text.slice(0, 200) || resp.statusText}`);
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by blank lines
    let sepIndex: number;
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      const payloadStr = dataLine.slice("data: ".length).trim();
      if (!payloadStr || payloadStr === "{}") continue;

      try {
        const payload = JSON.parse(payloadStr);
        if (payload.type === "summary") {
          cb.onSummary({
            durationMs: payload.durationMs ?? 0,
            guardrailsFired: payload.guardrailsFired ?? [],
            finalResponse: payload.finalResponse ?? "",
            sessionId: payload.sessionId,
          });
        } else if (payload.type) {
          cb.onStep(payload as TraceStep);
        }
      } catch {
        // ignore malformed frames
      }
    }
  }
}

export function emptyTrace(transcript: string): Trace {
  return {
    transcript,
    steps: [],
    finalResponse: "",
    guardrailsFired: [],
    durationMs: 0,
  };
}
