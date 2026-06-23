import { getReadablePageText, speakText, stopSpeaking } from "../utils/speechUtils";

function AccessibilityToolbar({ preferences, onTogglePreference, onResetPreferences }) {
  function handleReadPage() {
    const text = getReadablePageText();
    const spoken = speakText(text);

    if (!spoken) {
      window.alert("Read aloud is not available in this browser. You can still use a screen reader or your device accessibility tools.");
    }
  }

  return (
    <section className="ss-accessibility-toolbar" aria-label="Accessibility tools">
      <div className="container">
        <div className="ss-accessibility-inner">
          <div className="ss-accessibility-title">
            <i className="bi bi-universal-access" aria-hidden="true" />
            <span>Accessibility tools</span>
          </div>

          <div className="ss-accessibility-actions" role="group" aria-label="Accessibility display and reading options">
            <button
              type="button"
              className={`btn ss-a11y-btn ${preferences.largeText ? "active" : ""}`}
              onClick={() => onTogglePreference("largeText")}
              aria-pressed={preferences.largeText}
            >
              <i className="bi bi-fonts" aria-hidden="true" /> Larger text
            </button>

            <button
              type="button"
              className={`btn ss-a11y-btn ${preferences.highContrast ? "active" : ""}`}
              onClick={() => onTogglePreference("highContrast")}
              aria-pressed={preferences.highContrast}
            >
              <i className="bi bi-circle-half" aria-hidden="true" /> High contrast
            </button>

            <button
              type="button"
              className={`btn ss-a11y-btn ${preferences.reduceMotion ? "active" : ""}`}
              onClick={() => onTogglePreference("reduceMotion")}
              aria-pressed={preferences.reduceMotion}
            >
              <i className="bi bi-person-walking" aria-hidden="true" /> Reduce motion
            </button>

            <button type="button" className="btn ss-a11y-btn" onClick={handleReadPage}>
              <i className="bi bi-volume-up" aria-hidden="true" /> Read page
            </button>

            <button type="button" className="btn ss-a11y-btn" onClick={stopSpeaking}>
              <i className="bi bi-stop-circle" aria-hidden="true" /> Stop reading
            </button>

            <button type="button" className="btn ss-a11y-btn muted" onClick={onResetPreferences}>
              Reset
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AccessibilityToolbar;
