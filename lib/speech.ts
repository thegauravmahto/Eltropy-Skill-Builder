// Hold-to-speak using browser-native Web Speech API.
// Free, no Gemini Live yet — that's deferred to Phase 2.
// Chrome / Edge / Safari supported; Firefox limited.

interface SRResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SREvent {
  resultIndex: number;
  results: { length: number; [i: number]: SRResult };
}
interface SRErrorEvent {
  error: string;
}
interface SRInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
interface SRConstructor {
  new (): SRInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  }
}

export function isSpeechSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createRecognizer(opts: {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (msg: string) => void;
}) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) {
    opts.onError?.("Speech recognition not supported in this browser.");
    return null;
  }
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = false;

  let finalText = "";

  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim) opts.onInterim?.(finalText + interim);
  };

  rec.onerror = (e) => {
    opts.onError?.(e.error || "speech recognition error");
  };

  rec.onend = () => {
    if (finalText.trim()) opts.onFinal(finalText.trim());
  };

  return {
    start: () => {
      finalText = "";
      rec.start();
    },
    stop: () => rec.stop(),
  };
}
