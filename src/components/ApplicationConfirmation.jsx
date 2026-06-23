import { formatPathwayLabel, formatStatusLabel } from "../utils/displayLabels";

function getScreeningStatus(result) {
  if (result?.duplicate) return "EXISTING_APPLICATION";
  if (result?.screeningStatus) return result.screeningStatus;
  if (result?.status === "ELIGIBLE_PENDING_SKILLS_TEST") return "ELIGIBLE";
  if (result?.status === "PENDING_REVIEW") return "PENDING_REVIEW";
  if (result?.status === "INELIGIBLE") return "NOT_ELIGIBLE";
  if (result?.isEligible === true) return "ELIGIBLE";
  return "PENDING_REVIEW";
}

function getReference(result) {
  if (result?.hideApplicationReference) return null;

  return (
    result?.applicationReference ||
    result?.referenceNumber ||
    result?.registrationReference ||
    result?.registrationId ||
    null
  );
}

function formatSubmittedAt(value) {
  if (!value) return "Just now";

  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Just now";
  }
}

function getOutcomeLabel(result) {
  const screeningStatus = getScreeningStatus(result);

  if (screeningStatus === "ELIGIBLE") return "Eligible - Pending Basic IT Skills Test";
  if (screeningStatus === "PENDING_REVIEW") return "Pending manual review";
  if (screeningStatus === "NOT_ELIGIBLE") return "Not eligible";
  return "Existing application";
}

function getNextStepCopy(result) {
  const screeningStatus = getScreeningStatus(result);

  if (screeningStatus === "EXISTING_APPLICATION") {
    return result?.existingApplicationOpened === false
      ? {
          title: "Existing application found",
          body: "A new application was not created. Please contact the project team if you need help accessing the existing application.",
        }
      : {
          title: "Continue with the existing application",
          body: "A new application was not created. The existing application summary is shown below.",
        };
  }

  if (screeningStatus === "ELIGIBLE") {
    return {
      title: "Complete the Basic IT skills test",
      body: "A secure Basic IT skills test invitation link has been sent to the email address used during registration.",
    };
  }

  return {
    title: "Manual review",
    body: "The project team will review the application before deciding the next step.",
  };
}


function getIneligibilityFeedback(result) {
  const feedback = Array.isArray(result?.eligibilityFeedback)
    ? result.eligibilityFeedback.filter(Boolean)
    : [];

  if (feedback.length > 0) return feedback;

  if (result?.eligibilityReason) {
    return [result.eligibilityReason];
  }

  return [
    "The application did not meet one or more of the current programme requirements.",
  ];
}

function IneligibleConfirmation({ result, selectedPathway, onStartNewApplication }) {
  return (
    <main id="main-content" tabIndex="-1" className="ss-confirmation-page">
      <section className="ss-confirmation-hero" aria-labelledby="confirmation-title">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-12 col-xl-9">
              <div className="ss-confirmation-card review">
                <div className="ss-confirmation-icon" aria-hidden="true">
                  <i className="bi bi-info-circle" />
                </div>

                <span className="ss-small-label dark">Application outcome</span>
                <h1 id="confirmation-title">Unfortunately, you are not eligible for this programme at this time.</h1>
                <p className="ss-confirmation-lead">
                  Thank you for your interest in the <strong>{selectedPathway?.title || "Digital Futures programme"}</strong>. Your details have been received, but the application does not meet the current requirements.
                </p>

                <div className="ss-feedback-panel" role="note" aria-labelledby="ineligibility-feedback-title">
                  <div className="ss-feedback-panel-header">
                    <i className="bi bi-info-circle" aria-hidden="true" />
                    <h2 id="ineligibility-feedback-title">Why this application is not eligible</h2>
                  </div>
                  <ul>
                    {getIneligibilityFeedback(result).map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>

                <p className="ss-confirmation-footnote compact">
                  Please do not submit another application with the same phone number or email address. If you believe this result is incorrect, contact the project team for support.
                </p>

                <div className="ss-confirmation-actions">
                  <button type="button" className="btn ss-btn-primary" onClick={onStartNewApplication}>
                    <i className="bi bi-house" aria-hidden="true" /> Return to pathways
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ApplicationConfirmation({ result, selectedPathway, onStartNewApplication, onCheckStatus }) {
  const screeningStatus = getScreeningStatus(result);
  const isEligible = screeningStatus === "ELIGIBLE";
  const isDuplicate = screeningStatus === "EXISTING_APPLICATION";
  const isIneligible =
    screeningStatus === "NOT_ELIGIBLE" ||
    result?.status === "INELIGIBLE" ||
    result?.hideApplicationReference === true;
  const reference = getReference(result);
  const canCheckStatus = Boolean(reference) && result?.allowStatusCheck !== false;
  const nextStep = getNextStepCopy(result);

  if (isIneligible && !isDuplicate) {
    return (
      <IneligibleConfirmation
        result={result}
        selectedPathway={selectedPathway}
        onStartNewApplication={onStartNewApplication}
      />
    );
  }

  function handlePrint() {
    window.print();
  }

  return (
    <main id="main-content" tabIndex="-1" className="ss-confirmation-page">
      <section className="ss-confirmation-hero" aria-labelledby="confirmation-title">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-12 col-xl-10">
              <div className={`ss-confirmation-card ${isEligible ? "eligible" : "review"}`}>
                <div className="ss-confirmation-icon" aria-hidden="true">
                  <i className={`bi ${isDuplicate ? "bi-info-circle" : "bi-check2-circle"}`} />
                </div>

                <span className="ss-small-label dark">{isDuplicate ? "Existing application" : "Application submitted"}</span>
                <h1 id="confirmation-title">
                  {isDuplicate
                    ? "This application already exists."
                    : "Thank you. Your registration has been received."}
                </h1>
                <p className="ss-confirmation-lead">
                  {isDuplicate
                    ? result?.existingApplicationOpened === false
                      ? "A new application was not created. Please contact the project team if you need help accessing the existing application."
                      : "A new application was not created. We have opened the existing application summary below."
                    : <>Your application for the <strong>{selectedPathway?.title || result?.pathway || "selected pathway"}</strong> has been saved successfully.</>}
                </p>

                {reference && (
                  <div className="ss-reference-box" aria-label={`Your application reference is ${reference}`}>
                    <span>Application reference</span>
                    <strong>{reference}</strong>
                    <small>Submitted: {formatSubmittedAt(result?.submittedAt)}</small>
                  </div>
                )}

                <div className="ss-confirmation-grid" role="list">
                  {result?.participantCode && (
                    <div className="ss-confirmation-detail" role="listitem">
                      <span>Unique participant ID</span>
                      <strong>{result.participantCode}</strong>
                    </div>
                  )}
                  {result?.status && (
                    <div className="ss-confirmation-detail" role="listitem">
                      <span>Status</span>
                      <strong>{formatStatusLabel(result.status)}</strong>
                    </div>
                  )}
                  <div className="ss-confirmation-detail" role="listitem">
                    <span>Application outcome</span>
                    <strong>{getOutcomeLabel(result)}</strong>
                  </div>
                  <div className="ss-confirmation-detail" role="listitem">
                    <span>Pathway</span>
                    <strong>{formatPathwayLabel(result?.pathway || selectedPathway?.title || selectedPathway?.id, "Physical Academy")}</strong>
                  </div>
                </div>

                {canCheckStatus && (
                  <div className="ss-eligibility-note" role="note">
                    <i className="bi bi-phone" aria-hidden="true" />
                    <p>
                      Keep this application reference. You can check the application status using either the reference or the same mobile number entered during registration.
                    </p>
                  </div>
                )}

                {isEligible && (
                  <div className="ss-eligibility-note" role="note">
                    <i className="bi bi-envelope-check" aria-hidden="true" />
                    <p>
                      Please check the email address used during registration. The secure test link is tied to this participant ID and can only be used for this application.
                    </p>
                  </div>
                )}

                {isEligible && result?.skillsTestInviteUrl && result?.testInvitationEmailSent === false && (
                  <div className="ss-eligibility-note" role="note">
                    <i className="bi bi-link-45deg" aria-hidden="true" />
                    <p>
                      Local testing link: <a href={result.skillsTestInviteUrl}>Open Basic IT skills test</a>
                    </p>
                  </div>
                )}

                <div className="ss-next-steps" aria-labelledby="next-steps-title">
                  <h2 id="next-steps-title">What happens next?</h2>
                  <div className="ss-timeline">
                    <div className="ss-timeline-item complete">
                      <span aria-hidden="true">1</span>
                      <div>
                        <strong>Application received</strong>
                        <p>The application record is retained in the system.</p>
                      </div>
                    </div>
                    <div className="ss-timeline-item active">
                      <span aria-hidden="true">2</span>
                      <div>
                        <strong>{nextStep.title}</strong>
                        <p>{nextStep.body}</p>
                      </div>
                    </div>
                    <div className="ss-timeline-item">
                      <span aria-hidden="true">3</span>
                      <div>
                        <strong>Committee review and pathway enrollment</strong>
                        <p>Applicants who complete the required steps are reviewed before final enrollment.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ss-confirmation-actions">
                  <button type="button" className="btn ss-btn-primary" onClick={handlePrint}>
                    <i className="bi bi-printer" aria-hidden="true" /> Print confirmation
                  </button>
                  {canCheckStatus && (
                    <button type="button" className="btn ss-btn-outline" onClick={onCheckStatus}>
                      <i className="bi bi-search" aria-hidden="true" /> Check status
                    </button>
                  )}
                  <button type="button" className="btn ss-btn-outline" onClick={onStartNewApplication}>
                    <i className="bi bi-house" aria-hidden="true" /> Return to pathways
                  </button>
                </div>

                <p className="ss-confirmation-footnote">
                  Do not submit another application using the same email address or phone number. This confirmation does not guarantee final enrollment.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default ApplicationConfirmation;
