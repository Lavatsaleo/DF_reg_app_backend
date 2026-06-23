function DocumentUploadSection({
  stepNumber,
  totalSteps,
  isActive,
  documents,
  documentType,
  onToggle,
  onPrevious,
  onContinue,
  onDocumentsChange,
  onDocumentTypeChange,
}) {
  const status = documents.length > 0 ? "complete" : "optional";
  const panelId = "wizard-documents-panel";
  const buttonId = "wizard-documents-button";

  return (
    <section className={`ss-wizard-section ${isActive ? "active" : ""} ${status}`}>
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
            <span>Supporting documents</span>
            <small>ID, disability and education evidence</small>
          </span>
          <span className={`ss-wizard-status-badge ${status === "complete" ? "complete" : "not_started"}`}>
            <i className={`bi ${documents.length > 0 ? "bi-check2" : "bi-paperclip"}`} aria-hidden="true" />
            {documents.length > 0 ? "Files selected" : "Optional"}
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
        <div className="ss-document-grid">
          <div>
            <label className="form-label" htmlFor="document-type">
              Document type
            </label>
            <select
              id="document-type"
              className="form-select"
              value={documentType}
              onChange={(event) => onDocumentTypeChange(event.target.value)}
              aria-describedby="document-type-help"
            >
              <option value="DISABILITY_DOCUMENT">Disability document</option>
              <option value="NATIONAL_ID">National ID</option>
              <option value="PASSPORT">Passport</option>
              <option value="EDUCATION_CERTIFICATE">Education certificate</option>
              <option value="CONSENT_FORM">Consent form</option>
              <option value="OTHER">Other</option>
            </select>
            <small id="document-type-help" className="ss-field-help">
              Choose the main type of document you are uploading. You can upload more than one file.
            </small>
          </div>

          <div className="ss-upload-box">
            <i className="bi bi-cloud-arrow-up" aria-hidden="true" />
            <div>
              <label className="form-label" htmlFor="supporting-documents-upload">
                Upload supporting files
              </label>
              <p id="supporting-documents-help">
                Attach ID, disability documentation, academic certificate/transcript, or any other supporting document available. Accepted formats: PDF, PNG, JPG, JPEG, DOC, or DOCX.
              </p>
              <input
                id="supporting-documents-upload"
                className="form-control"
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                aria-describedby="supporting-documents-help"
                onChange={(event) => onDocumentsChange(Array.from(event.target.files || []))}
              />
            </div>
          </div>
        </div>

        {documents.length > 0 && (
          <ul className="ss-file-list" aria-label="Selected files">
            {documents.map((file) => (
              <li key={`${file.name}-${file.size}`}>
                <i className="bi bi-paperclip" aria-hidden="true" /> {file.name} — {(file.size / 1024).toFixed(1)} KB
              </li>
            ))}
          </ul>
        )}

        <div className="ss-wizard-actions">
          <button type="button" className="btn ss-btn-outline" onClick={onPrevious}>
            <i className="bi bi-arrow-left" aria-hidden="true" /> Previous
          </button>

          <button type="button" className="btn ss-btn-primary" onClick={onContinue}>
            Continue to review <i className="bi bi-arrow-right" aria-hidden="true" />
          </button>
        </div>

        <p className="ss-wizard-step-counter">Step {stepNumber} of {totalSteps}</p>
      </div>
    </section>
  );
}

export default DocumentUploadSection;
