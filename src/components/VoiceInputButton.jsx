import { useRef, useState } from "react";
import { getSpeechRecognitionConstructor, isSpeechRecognitionSupported } from "../utils/speechUtils";

function cleanTranscriptForType(transcript, responseType) {
  const value = String(transcript || "").trim();

  if (responseType === "PHONE") {
    return value
      .replace(/plus/gi, "+")
      .replace(/[^+0-9]/g, "");
  }

  if (responseType === "NUMBER") {
    return value.replace(/[^0-9.-]/g, "");
  }

  return value;
}

function VoiceInputButton({ question, onTranscript }) {
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const recognitionRef = useRef(null);
  const supported = isSpeechRecognitionSupported();

  function startListening() {
    if (!supported) {
      setMessage("Voice typing is not available in this browser.");
      return;
    }

    const SpeechRecognition = getSpeechRecognitionConstructor();
    const recognition = new SpeechRecognition();

    recognition.lang = navigator.language || "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setMessage("Listening...");
    };

    recognition.onerror = () => {
      setListening(false);
      setMessage("Voice typing stopped. Please try again or type your answer.");
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      const cleanTranscript = cleanTranscriptForType(transcript, question.responseType);

      if (cleanTranscript) {
        onTranscript(cleanTranscript);
        setMessage("Answer added from your voice.");
      } else {
        setMessage("I did not hear a clear answer. Please try again or type your answer.");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  return (
    <div className="ss-voice-input">
      <button
        type="button"
        className={`btn ss-voice-btn ${listening ? "listening" : ""}`}
        onClick={listening ? stopListening : startListening}
        aria-label={`Speak answer for ${question.questionText}`}
        title={supported ? "Speak answer" : "Voice typing is not supported in this browser"}
      >
        <i className={`bi ${listening ? "bi-stop-fill" : "bi-mic-fill"}`} aria-hidden="true" />
        {listening ? "Stop" : "Speak answer"}
      </button>
      {message && <small role="status">{message}</small>}
    </div>
  );
}

export default VoiceInputButton;
