export function getSpeechSynthesis() {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis || null;
}

export function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported() {
  return Boolean(getSpeechRecognitionConstructor());
}

export function speakText(text) {
  const speech = getSpeechSynthesis();
  const cleanText = String(text || "").replace(/\s+/g, " ").trim();

  if (!speech || !cleanText) {
    return false;
  }

  speech.cancel();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 0.92;
  utterance.pitch = 1;
  utterance.volume = 1;

  speech.speak(utterance);
  return true;
}

export function stopSpeaking() {
  const speech = getSpeechSynthesis();
  if (speech) speech.cancel();
}

export function getReadablePageText() {
  if (typeof document === "undefined") return "";

  const main = document.querySelector("main") || document.body;
  const hiddenSelectors = [
    "script",
    "style",
    "noscript",
    "[aria-hidden='true']",
    ".visually-hidden",
    ".ss-accessibility-toolbar",
  ];

  const clone = main.cloneNode(true);
  hiddenSelectors.forEach((selector) => {
    clone.querySelectorAll(selector).forEach((node) => node.remove());
  });

  return clone.textContent.replace(/\s+/g, " ").trim();
}
