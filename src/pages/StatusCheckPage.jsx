import { useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { formatPathwayLabel, formatStatusLabel } from "../utils/displayLabels";
import {
  findSubmittedApplication,
  listSubmittedApplications,
} from "../utils/applicationStatusStorage";

const STATUS_STEPS = [
  {
    key: "submitted",
    labels: ["submitted"],
    title: "Application submitted",
    description: "Your registration has been received and a participant identifier has been assigned.",
  },
  {
    key: "screening",
    labels: ["pending review", "ineligible"],
    title: "Application review",
    description: "The application information is reviewed and may be flagged for manual review.",
  },
  {
    key: "skills",
    labels: ["eligible pending skills test", "eligible pending basic skills test"],
    title: "Basic IT skills test",
    description: "Eligible applicants complete the short skills test using the secure email invitation link.",
  },
  {
    key: "review",
    labels: ["skills test completed pending review", "under review", "review", "synced to dhis2 pending review"],
    title: "Committee review",
    description: "The committee reviews registration details, documents, and test results.",
  },
  {
    key: "decision",
    labels: ["approved", "rejected", "approved for enrollment", "rejected by review committee"],
    title: "Decision made",
    description: "A decision is recorded and the applicant is informed through the agreed communication channel.",
  },
  {
    key: "dhis2",
    labels: ["synced to dhis2", "enrolled", "enrolled in dhis2", "enrolled in dhis2 program"],
    title: "Programme enrollment",
    description: "Approved applicants are enrolled into the correct pathway/programme workflow.",
  },
];

function normalizeStatus(value) {
  return String(value || "Submitted").trim().toLowerCase().replace(/_/g, " ");
}

function getActiveStepIndex(status) {
  const normalizedStatus = normalizeStatus(status);

  const exactIndex = STATUS_STEPS.findIndex((step) =>
    step.labels.some((label) => normalizedStatus === label)
  );

  if (exactIndex >= 0) return exactIndex;
  if (normalizedStatus.includes("enrolled")) return 5;
  if (normalizedStatus.includes("approved") || normalizedStatus.includes("rejected")) return 4;
  if (normalizedStatus.includes("completed") || normalizedStatus.includes("committee") || normalizedStatus.includes("dhis2")) return 3;
  if (normalizedStatus.includes("skills")) return 2;
  if (normalizedStatus.includes("eligible") || normalizedStatus.includes("review") || normalizedStatus.includes("ineligible")) return 1;
  return 0;
}

function formatDate(value) {
  if (!value) return "Not available";

  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Not available";
  }
}

function getReferenceFromResult(result) {
  return (
    result?.applicationReference ||
    result?.referenceNumber ||
    result?.registrationReference ||
    result?.registrationId ||
    result?.id ||
    ""
  );
}

function getScreeningLabel(result) {
  if (result?.screeningStatus === "ELIGIBLE" || result?.isEligible === true) return "Eligible";
  if (result?.screeningStatus === "NOT_ELIGIBLE" || result?.status === "INELIGIBLE") return "Not eligible";
  return "Pending review";
}

function StatusTimeline({ status }) {
  const activeStepIndex = getActiveStepIndex(status);

  return (
    <div className="ss-status-timeline" aria-label="Application status progress">
      {STATUS_STEPS.map((step, index) => {
        const isComplete = index < activeStepIndex;
        const isActive = index === activeStepIndex;

        return (
          <div
            key={step.key}
            className={`ss-status-step ${isComplete ? "complete" : ""} ${isActive ? "active" : ""}`}
          >
            <span aria-hidden="true">
              {isComplete ? <i className="bi bi-check2" /> : index + 1}
            </span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusResultCard({ result, source }) {
  const reference = getReferenceFromResult(result);
  const status = result?.status || "Submitted";
  const statusLabel = formatStatusLabel(status);

  return (
    <article className="ss-status-result-card" aria-labelledby="status-result-title">
      <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
        <div>
          <span className="ss-small-label dark">Application found</span>
          <h2 id="status-result-title">Current application status</h2>
          <p className="mb-0">
            The information below shows the latest status available to this portal.
          </p>
        </div>
        <div className="ss-status-badge" aria-label={`Current status is ${statusLabel}`}>
          {statusLabel}
        </div>
      </div>

      <div className="ss-status-summary-grid" role="list">
        <div role="listitem">
          <span>Application reference</span>
          <strong>{reference || "Not available"}</strong>
        </div>
        <div role="listitem">
          <span>Unique participant ID</span>
          <strong>{result?.participantCode || "Not available"}</strong>
        </div>
        <div role="listitem">
          <span>Application review</span>
          <strong>{getScreeningLabel(result)}</strong>
        </div>
        <div role="listitem">
          <span>Pathway</span>
          <strong>{formatPathwayLabel(result?.pathwayTitle || result?.pathway, "Physical Academy")}</strong>
        </div>
        <div role="listitem">
          <span>Submitted</span>
          <strong>{formatDate(result?.submittedAt || result?.savedAt)}</strong>
        </div>
        <div role="listitem">
          <span>Source</span>
          <strong>{source === "server" ? "Official system" : "This device"}</strong>
        </div>
      </div>

      {result?.nextStepMessage && (
        <div className="ss-status-note" role="note">
          <i className="bi bi-signpost-2" aria-hidden="true" />
          <p>{result.nextStepMessage}</p>
        </div>
      )}

      {result?.eligibilityReason && (
        <div className="ss-status-note" role="note">
          <i className="bi bi-info-circle" aria-hidden="true" />
          <p>{result.eligibilityReason}</p>
        </div>
      )}

      {result?.skillsTest?.submitted && (
        <div className="ss-status-note" role="note">
          <i className="bi bi-journal-check" aria-hidden="true" />
          <p>
            Basic IT skills test submitted. Score: {result.skillsTest.score}/{result.skillsTest.maxScore} ({result.skillsTest.percentage}%).
          </p>
        </div>
      )}

      {result?.requiresBasicSkillsTest && (
        <div className="ss-status-note" role="note">
          <i className="bi bi-envelope-check" aria-hidden="true" />
          <div>
            <p className="mb-2">You are eligible. Please open the Basic IT skills test using the secure invitation link sent to your email address.</p>
            {result?.testInvitation?.expiresAt && (
              <p className="mb-0">Invitation expires: {formatDate(result.testInvitation.expiresAt)}.</p>
            )}
          </div>
        </div>
      )}

      <StatusTimeline status={status} />
    </article>
  );
}

function StatusCheckPage({ onBackHome, onStartApplication }) {
  const [identifier, setIdentifier] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupSource, setLookupSource] = useState("");
  const [lookupMessage, setLookupMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const recentApplications = useMemo(() => listSubmittedApplications().slice(0, 3), []);

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanIdentifier = identifier.trim();
    setLookupResult(null);
    setLookupSource("");
    setLookupMessage("");

    if (!cleanIdentifier) {
      setLookupMessage("Please enter your application reference number or mobile number.");
      return;
    }

    try {
      setLoading(true);

      const response = await axios.get(
        `${API_BASE_URL}/api/registrations/status/${encodeURIComponent(cleanIdentifier)}`
      );

      const apiResult = response.data?.data || response.data?.application || response.data?.registration || response.data;
      if (apiResult && getReferenceFromResult(apiResult)) {
        setLookupResult(apiResult);
        setLookupSource("server");
        return;
      }

      throw new Error("No official status returned");
    } catch {
      const localResult = findSubmittedApplication(cleanIdentifier);

      if (localResult) {
        setLookupResult(localResult);
        setLookupSource("local");
        setLookupMessage(
          "Showing the confirmation saved on this device because the official status lookup could not be reached."
        );
      } else {
        setLookupMessage(
          "We could not find an application using that reference or mobile number. Check the details and use the same mobile number entered during registration."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function handleRecentClick(application) {
    const recentReference = getReferenceFromResult(application);
    setIdentifier(recentReference);
    setLookupResult(application);
    setLookupSource("local");
    setLookupMessage("Showing a recently submitted application saved on this device.");
  }

  return (
    <main id="main-content" tabIndex="-1" className="ss-status-page">
      <section className="ss-status-hero" aria-labelledby="status-page-title">
        <div className="container">
          <div className="row align-items-center g-4">
            <div className="col-12 col-lg-8">
              <button type="button" className="btn ss-btn-outline mb-4" onClick={onBackHome}>
                <i className="bi bi-arrow-left" aria-hidden="true" /> Back to home
              </button>
              <span className="ss-small-label light">Application tracking</span>
              <h1 id="status-page-title">Check your registration status</h1>
              <p>
                Enter your application reference or the mobile number used during registration to see the latest status available to this portal.
              </p>
            </div>
            <div className="col-12 col-lg-4">
              <div className="ss-selected-card">
                <span>Applicant support</span>
                <strong>Use your reference or mobile number</strong>
                <small>Example: SS-PHYS-20260525-ABCDE or +254712345678</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-5">
        <div className="row g-4 align-items-start">
          <div className="col-12 col-xl-8">
            <section className="ss-status-lookup-card" aria-labelledby="lookup-title">
              <span className="ss-small-label dark">Find application</span>
              <h2 id="lookup-title">Find your application</h2>
              <p>
                Use the application reference shown after submission or the same mobile number entered in the application form.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <label className="form-label" htmlFor="application-reference">
                  Application reference or mobile number
                </label>
                <div className="ss-status-search-row">
                  <input
                    id="application-reference"
                    className="form-control"
                    type="text"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="Reference or mobile number"
                    autoComplete="tel"
                  />
                  <button type="submit" className="btn ss-btn-primary" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Checking...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-search" aria-hidden="true" /> Check status
                      </>
                    )}
                  </button>
                </div>
              </form>

              {lookupMessage && (
                <div className="alert ss-alert-info mt-4" role="status" aria-live="polite">
                  <i className="bi bi-info-circle" aria-hidden="true" /> {lookupMessage}
                </div>
              )}

              {lookupResult && (
                <div className="mt-4">
                  <StatusResultCard result={lookupResult} source={lookupSource} />
                </div>
              )}
            </section>
          </div>

          <div className="col-12 col-xl-4">
            <div className="ss-sticky-panel">
              <div className="ss-help-card">
                <span className="ss-small-label dark">What your status means</span>
                <ul className="ss-status-help-list">
                  <li><strong>Submitted:</strong> your application was received.</li>
                  <li><strong>Pending Review:</strong> the project team needs to review eligibility details before sending a test invitation.</li>
                  <li><strong>Eligible Pending Skills Test:</strong> check your email for the secure test link.</li>
                  <li><strong>Under Review:</strong> the committee checks registration details, documents, and test result.</li>
                  <li><strong>Approved:</strong> the applicant can move to enrollment.</li>
                </ul>
              </div>

              {recentApplications.length > 0 && (
                <div className="ss-help-card mt-4">
                  <span className="ss-small-label dark">Recent on this device</span>
                  <div className="ss-recent-reference-list">
                    {recentApplications.map((application) => {
                      const recentReference = getReferenceFromResult(application);
                      return (
                        <button
                          key={recentReference}
                          type="button"
                          className="ss-recent-reference"
                          onClick={() => handleRecentClick(application)}
                        >
                          <strong>{recentReference}</strong>
                          <span>{application.pathwayTitle || application.pathway || "Physical Academy"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="ss-help-card mt-4">
                <span className="ss-small-label dark">No reference yet?</span>
                <p>
                  Start one application and keep the confirmation reference after submission. You can also use the same mobile number entered in the form to check the application status.
                </p>
                <button type="button" className="btn ss-btn-outline w-100" onClick={onStartApplication}>
                  Start application
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default StatusCheckPage;
