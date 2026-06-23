function formatAnswer(value) {
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "Not answered";
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value === undefined || value === null || value === "") return "Not answered";
  return String(value);
}

function ReviewApplication({
  stepNumber,
  totalSteps,
  isActive,
  sectionEntries,
  answers,
  documents,
  documentType,
  submitting,
  onToggle,
  onPrevious,
  onEditSection,
}) {
  const panelId = "wizard-review-panel";
  const buttonId = "wizard-review-button";

  return (
    <section className={`ss-wizard-section ${isActive ? "active" : ""} review`}>
      <h2 className="ss-wizard-section-title">
        <button
          id={buttonId}
          type="button"
          className="ss-wizard-section-trigger"
          aria-expanded={isActive}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span className="ss-wizard-step-number" aria-hidden="true">
            {stepNumber}
          </span>
          <span className="ss-wizard-step-copy">
            <span>Review and submit</span>
            <small>Check your answers before sending</small>
          </span>
          <span className="ss-wizard-status-badge in_progress">
            <i className="bi bi-eye" aria-hidden="true" /> Review
          </span>
        </button>
      </h2>

      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={`ss-wizard-section-panel ${isActive ? "show" : ""}`}
        hidden={!isActive}
      >
        <div className="ss-review-intro">
          <i className="bi bi-shield-check" aria-hidden="true" />
          <div>
            <h3>Almost done</h3>
            <p>
              Review your application. Use the edit buttons to go back to a section, or submit when everything looks correct.
            </p>
          </div>
        </div>

        <div className="ss-review-stack">
          {sectionEntries.map(([section, questions], index) => (
            <article className="ss-review-card" key={section}>
              <div className="ss-review-card-header">
                <h3>{section}</h3>
                <button type="button" className="btn btn-sm ss-mini-edit-btn" onClick={() => onEditSection(index)}>
                  <i className="bi bi-pencil" aria-hidden="true" /> Edit
                </button>
              </div>

              <dl className="ss-review-list">
                {questions.map((question) => (
                  <div key={question.questionCode}>
                    <dt>{question.questionText}</dt>
                    <dd>{formatAnswer(answers[question.questionCode])}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}

          <article className="ss-review-card">
            <div className="ss-review-card-header">
              <h3>Supporting documents</h3>
              <button type="button" className="btn btn-sm ss-mini-edit-btn" onClick={() => onEditSection(sectionEntries.length)}>
                <i className="bi bi-pencil" aria-hidden="true" /> Edit
              </button>
            </div>
            <dl className="ss-review-list">
              <div>
                <dt>Document type</dt>
                <dd>{documentType}</dd>
              </div>
              <div>
                <dt>Files selected</dt>
                <dd>{documents.length > 0 ? documents.map((file) => file.name).join(", ") : "No files selected"}</dd>
              </div>
            </dl>
          </article>
        </div>

        <div className="ss-submit-once-note" role="note">
          <i className="bi bi-shield-check" aria-hidden="true" />
          <p>
            Submit this application only once. If the same application is submitted again, the system will open the existing application summary instead of creating a duplicate record.
          </p>
        </div>

        <div className="ss-wizard-actions final">
          <button type="button" className="btn ss-btn-outline" onClick={onPrevious} disabled={submitting}>
            <i className="bi bi-arrow-left" aria-hidden="true" /> Previous
          </button>

          <button type="submit" className="btn ss-submit-btn" disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Submitting...
              </>
            ) : (
              <>
                Submit registration <i className="bi bi-send" aria-hidden="true" />
              </>
            )}
          </button>
        </div>

        <p className="ss-wizard-step-counter">Step {stepNumber} of {totalSteps}</p>
      </div>
    </section>
  );
}

export default ReviewApplication;
