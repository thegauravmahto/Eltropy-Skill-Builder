// Voice client for Gemini Live API harness.
// - captures mic at PCM16 mono 16 kHz, streams to /live WebSocket as binary
// - receives PCM16 mono 24 kHz from server, queues into AudioContext for playback
// - text frames (transcripts / tool-calls / guardrails) surface via callbacks

import { getApiKey, getHarnessUrl } from "./harness";

export interface VoiceEvent {
  type: "transcript" | "tool-call" | "guardrail" | "sub-agent" | "error" | "ready";
  role?: "user" | "model";
  text?: string;
  is_final?: boolean;
  name?: string;
  args?: Record<string, unknown>;
  label?: string;
  detail?: string;
  blocked?: boolean;
  message?: string;
  session_id?: string;
}

export interface VoiceSessionOpts {
  authenticated: boolean;
  memberId?: string;
  sessionId?: string;
  onEvent: (e: VoiceEvent) => void;
  onClose: () => void;
}

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const CHUNK_SAMPLES = 1024; // ~64 ms at 16 kHz

export interface VoiceSessionHandle {
  stop: () => Promise<void>;
  setTalking: (talking: boolean) => void;
}

export async function startVoiceSession(opts: VoiceSessionOpts): Promise<VoiceSessionHandle | null> {
  const harnessUrl = getHarnessUrl();
  const key = getApiKey();
  if (!harnessUrl) {
    opts.onEvent({ type: "error", message: "Harness URL not configured." });
    return null;
  }
  if (!key) {
    opts.onEvent({ type: "error", message: "Set your Gemini API key in Settings." });
    return null;
  }

  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let playCtx: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let nextPlayTime = 0;
  let closed = false;
  let talking = false; // push-to-talk gate
  let lastTalking = false;

  const wsUrl = harnessUrl.replace(/^http/, "ws") + "/live";
  const ws = new WebSocket(wsUrl);
  ws.binaryType = "arraybuffer";

  function stop(): Promise<void> {
    if (closed) return Promise.resolve();
    closed = true;
    try {
      processor?.disconnect();
      source?.disconnect();
    } catch {}
    stream?.getTracks().forEach((t) => t.stop());
    try {
      audioCtx?.close();
    } catch {}
    try {
      playCtx?.close();
    } catch {}
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "end" }));
      } catch {}
      ws.close();
    }
    opts.onClose();
    return Promise.resolve();
  }

  ws.onopen = async () => {
    ws.send(
      JSON.stringify({
        type: "start",
        key,
        authenticated: opts.authenticated,
        member_id: opts.memberId ?? null,
        session_id: opts.sessionId ?? null,
      })
    );

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
    } catch (e) {
      opts.onEvent({ type: "error", message: `Microphone access denied: ${(e as Error).message}` });
      stop();
      return
    }

    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctx({ sampleRate: INPUT_RATE });
    playCtx = new Ctx({ sampleRate: OUTPUT_RATE });
    nextPlayTime = playCtx.currentTime;

    source = audioCtx.createMediaStreamSource(stream);
    // ScriptProcessor is deprecated but works everywhere — fine for this demo.
    processor = audioCtx.createScriptProcessor(CHUNK_SAMPLES, 1, 1);
    processor.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN || closed) return;
      // Push-to-talk: emit activity_start/end boundaries so the model knows
      // when the user starts and stops speaking.
      if (talking !== lastTalking) {
        try {
          ws.send(JSON.stringify({ type: talking ? "activity_start" : "activity_end" }));
        } catch {}
        lastTalking = talking;
      }
      if (!talking) return;
      const input = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      ws.send(pcm16.buffer);
    };
    source.connect(processor);
    // ScriptProcessor must be connected to destination to run — route to silent gain.
    const muted = audioCtx.createGain();
    muted.gain.value = 0;
    processor.connect(muted);
    muted.connect(audioCtx.destination);
  };

  ws.onmessage = (e) => {
    if (typeof e.data === "string") {
      try {
        opts.onEvent(JSON.parse(e.data) as VoiceEvent);
      } catch {
        // ignore malformed
      }
      return;
    }
    // Binary frame = PCM16 mono 24 kHz from Gemini
    if (!playCtx) return;
    const ab = e.data as ArrayBuffer;
    const i16 = new Int16Array(ab);
    const f32 = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 0x8000;
    const buf = playCtx.createBuffer(1, f32.length, OUTPUT_RATE);
    buf.copyToChannel(f32, 0);
    const src = playCtx.createBufferSource();
    src.buffer = buf;
    src.connect(playCtx.destination);
    const startAt = Math.max(nextPlayTime, playCtx.currentTime);
    src.start(startAt);
    nextPlayTime = startAt + buf.duration;
  };

  ws.onerror = () => {
    opts.onEvent({ type: "error", message: "WebSocket error." });
  };
  ws.onclose = () => {
    stop();
  };

  return {
    stop,
    setTalking: (v: boolean) => {
      talking = v;
    },
  };
}
