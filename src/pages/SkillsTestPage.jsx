import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

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

function normalizeReference(value) {
  return String(value || "").trim().toUpperCase();
}

function cleanToken(value) {
  return String(value || "").trim();
}

function ResultPanel({ attempt, applicant, onCheckStatus }) {
  if (!attempt) return null;

  const passedLabel = attempt.passed
    ? "Passed basic test threshold"
    : "Below basic test threshold";

  return (
    <section className="ss-skills-result-card" aria-labelledby="skills-result-title">
      <span className="ss-small-label dark">Basic IT skills test submitted</span>
      <h2 id="skills-result-title">Your test result has been saved</h2>
      <p>
        The committee will review this result together with your registration information and supporting documents.
      </p>

      <div className="ss-skills-score-card" aria-label={`Score ${attempt.score} out of ${attempt.maxScore}`}>
        <span>Score</span>
        <strong>{attempt.score}/{attempt.maxScore}</strong>
        <small>{attempt.percentage}% · {passedLabel}</small>
      </div>

      <div className="ss-status-summary-grid mt-4" role="list">
        <div role="listitem">
          <span>Application reference</span>
          <strong>{applicant?.applicationReference || "Not available"}</strong>
        </div>
        <div role="listitem">
          <span>Participant code</span>
          <strong>{applicant?.participantCode || "Not available"}</strong>
        </div>
        <div role="listitem">
          <span>Submitted</span>
          <strong>{formatDate(attempt.submittedAt)}</strong>
        </div>
        <div role="listitem">
          <span>Passing threshold</span>
          <strong>{attempt.passingPercentage}%</strong>
        </div>
      </div>

      <div className="ss-confirmation-actions mt-4">
        <button type="button" className="btn ss-btn-primary" onClick={onCheckStatus}>
          <i className="bi bi-search" aria-hidden="true" /> Check application status
        </button>
      </div>
    </section>
  );
}

function SkillsTestQuestion({ question, value, onChange, hasError }) {
  return (
    <fieldset className={`ss-skills-question ${hasError ? "has-error" : ""}`}>
      <legend>
        <span>Question {question.questionNumber}</span>
        {question.questionText}
      </legend>
      <div className="ss-skills-option-list">
        {question.options.map((option) => {
          const optionId = `${question.questionCode}-${option.value}`;
          return (
            <label key={option.value} className="ss-skills-option" htmlFor={optionId}>
              <input
                id={optionId}
                type="radio"
                name={question.questionCode}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(question.questionCode, option.value)}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      {hasError && (
        <p className="ss-field-error" role="alert">
          Please answer this question.
        </p>
      )}
    </fieldset>
  );
}

function SkillsTestPage({ initialReference = "", initialToken = "", onBackHome, onCheckStatus }) {
  const [reference, setReference] = useState(initialReference);
  const [token, setToken] = useState(initialToken);
  const [applicant, setApplicant] = useState(null);
  const [invitation, setInvitation] = useState(null);
  const [test, setTest] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startTimeRef = useRef(null);

  const hasInvitationToken = Boolean(cleanToken(token));

  const answeredCount = useMemo(
    () => Object.values(answers).filter(Boolean).length,
    [answers]
  );

  const totalQuestions = test?.questions?.length || 0;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  function getQuestionsEndpoint(referenceToLoad, tokenToLoad) {
    const cleanInvitationToken = cleanToken(tokenToLoad);

    if (cleanInvitationToken) {
      return `${API_BASE_URL}/api/basic-skills-test/invite/${encodeURIComponent(cleanInvitationToken)}/questions`;
    }

    const cleanReference = normalizeReference(referenceToLoad);
    if (!cleanReference) return null;

    return `${API_BASE_URL}/api/basic-skills-test/${encodeURIComponent(cleanReference)}/questions`;
  }

  function getSubmitEndpoint() {
    const cleanInvitationToken = cleanToken(token);

    if (cleanInvitationToken) {
      return `${API_BASE_URL}/api/basic-skills-test/invite/${encodeURIComponent(cleanInvitationToken)}/submit`;
    }

    const cleanReference = normalizeReference(reference);
    if (!cleanReference) return null;

    return `${API_BASE_URL}/api/basic-skills-test/${encodeURIComponent(cleanReference)}/submit`;
  }

  async function loadTest({ referenceToLoad = reference, tokenToLoad = token } = {}) {
    const endpoint = getQuestionsEndpoint(referenceToLoad, tokenToLoad);
    setMessage("");
    setApplicant(null);
    setInvitation(null);
    setTest(null);
    setAttempt(null);
    setAnswers({});
    setFieldErrors({});

    if (!endpoint) {
      setMessage("Please open the test using the invitation link sent to your email. For local testing, you may enter the application reference number.");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(endpoint);

      const data = response.data || {};
      setApplicant(data.applicant || null);
      setInvitation(data.invitation || null);
      setTest(data.test || null);
      setAttempt(data.attempt || null);
      startTimeRef.current = Date.now();

      if (data.applicant?.applicationReference) {
        setReference(data.applicant.applicationReference);
      }

      if (data.alreadySubmitted) {
        setMessage("A Basic IT skills test has already been submitted for this application.");
      }
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Unable to load the Basic IT skills test. Please check the invitation link and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const cleanInitialToken = cleanToken(initialToken);
    const cleanInitialReference = normalizeReference(initialReference);
    setToken(cleanInitialToken);
    setReference(cleanInitialReference);

    if (cleanInitialToken || cleanInitialReference) {
      loadTest({
        tokenToLoad: cleanInitialToken,
        referenceToLoad: cleanInitialReference,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialReference, initialToken]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleLookupSubmit(event) {
    event.preventDefault();
    loadTest({ referenceToLoad: reference, tokenToLoad: "" });
  }

  function handleAnswerChange(questionCode, answer) {
    setAnswers((previousAnswers) => ({
      ...previousAnswers,
      [questionCode]: answer,
    }));

    setFieldErrors((previousErrors) => {
      if (!previousErrors[questionCode]) return previousErrors;
      const updatedErrors = { ...previousErrors };
      delete updatedErrors[questionCode];
      return updatedErrors;
    });
  }

  async function handleSubmitTest(event) {
    event.preventDefault();

    if (!test?.questions?.length) return;

    const endpoint = getSubmitEndpoint();

    if (!endpoint) {
      setMessage("Please open the test using the invitation link sent to your email.");
      return;
    }

    const validationErrors = {};
    test.questions.forEach((question) => {
      if (!answers[question.questionCode]) {
        validationErrors[question.questionCode] = "Required";
      }
    });

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setMessage("Please answer all questions before submitting the test.");
      window.requestAnimationFrame(() => {
        document.querySelector(".ss-skills-question.has-error")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");

      const durationSeconds = startTimeRef.current
        ? Math.round((Date.now() - startTimeRef.current) / 1000)
        : null;

      const response = await axios.post(endpoint, {
        answers,
        durationSeconds,
      });

      setAttempt(response.data?.attempt || null);
      setApplicant(response.data?.applicant || applicant);
      setInvitation(response.data?.invitation || invitation);
      setTest((previousTest) => ({ ...previousTest, questions: [] }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Unable to submit the Basic IT skills test. Please try again."
      );

      if (error.response?.data?.attempt) {
        setAttempt(error.response.data.attempt);
        setTest((previousTest) => ({ ...previousTest, questions: [] }));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main id="main-content" tabIndex="-1" className="ss-skills-page">
      <section className="ss-skills-hero" aria-labelledby="skills-page-title">
        <div className="container">
          <div className="row align-items-center g-4">
            <div className="col-12 col-lg-8">
              <button type="button" className="btn ss-btn-outline mb-4" onClick={onBackHome}>
                <i className="bi bi-arrow-left" aria-hidden="true" /> Back to home
              </button>
              <span className="ss-small-label light">Basic IT skills test</span>
              <h1 id="skills-page-title">Complete your basic IT skills test</h1>
              <p>
                Eligible applicants access this test through the secure invitation link sent by email. The result is tied to the same applicant record used during registration.
              </p>
            </div>
            <div className="col-12 col-lg-4">
              <div className="ss-selected-card">
                <span>Review package</span>
                <strong>Registration + test</strong>
                <small>Used by the review committee</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-5">
        <div className="row g-4 align-items-start">
          <div className="col-12 col-xl-8">
            <section className="ss-skills-card" aria-labelledby="access-title">
              <span className="ss-small-label dark">Step 1</span>
              <h2 id="access-title">{hasInvitationToken ? "Invitation link verified" : "Open your test invitation"}</h2>
              <p>
                {hasInvitationToken
                  ? "This page was opened from your secure Basic IT skills test invitation link."
                  : "Use the invitation link sent to your email. For local testing only, you can load the test using the application reference."}
              </p>

              {!hasInvitationToken && (
                <form onSubmit={handleLookupSubmit} noValidate>
                  <label className="form-label" htmlFor="skills-reference">
                    Application reference number
                  </label>
                  <div className="ss-status-search-row">
                    <input
                      id="skills-reference"
                      className="form-control"
                      type="text"
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      placeholder="Example: SS-PHYS-20260525-ABCDE"
                      autoComplete="off"
                    />
                    <button type="submit" className="btn ss-btn-primary" disabled={loading}>
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Loading...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-journal-check" aria-hidden="true" /> Load test
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {invitation && (
                <div className="ss-status-summary-grid mt-4" role="list">
                  <div role="listitem">
                    <span>Invitation status</span>
                    <strong>{invitation.status}</strong>
                  </div>
                  <div role="listitem">
                    <span>Expires</span>
                    <strong>{formatDate(invitation.expiresAt)}</strong>
                  </div>
                </div>
              )}

              {message && (
                <div className="alert ss-alert-info mt-4" role="status" aria-live="polite">
                  <i className="bi bi-info-circle" aria-hidden="true" /> {message}
                </div>
              )}
            </section>

            {attempt ? (
              <div className="mt-4">
                <ResultPanel attempt={attempt} applicant={applicant} onCheckStatus={onCheckStatus} />
              </div>
            ) : test?.questions?.length > 0 ? (
              <form className="ss-skills-card mt-4" onSubmit={handleSubmitTest} noValidate>
                <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-4">
                  <div>
                    <span className="ss-small-label dark">Step 2</span>
                    <h2>{test.title}</h2>
                    <p className="mb-0">{test.instructions}</p>
                  </div>
                  <div className="ss-status-badge">
                    {answeredCount}/{totalQuestions} answered
                  </div>
                </div>

                <div className="ss-skills-progress" aria-hidden="true">
                  <span style={{ width: `${progressPercent}%` }} />
                </div>

                {applicant && (
                  <div className="ss-skills-applicant-strip" role="note">
                    <i className="bi bi-person-check" aria-hidden="true" />
                    <span>
                      Test for <strong>{applicant.firstName} {applicant.lastName}</strong> · {applicant.applicationReference} · {applicant.participantCode}
                    </span>
                  </div>
                )}

                {test.questions.map((question) => (
                  <SkillsTestQuestion
                    key={question.questionCode}
                    question={question}
                    value={answers[question.questionCode]}
                    onChange={handleAnswerChange}
                    hasError={Boolean(fieldErrors[question.questionCode])}
                  />
                ))}

                <div className="ss-confirmation-actions mt-4">
                  <button type="submit" className="btn ss-btn-primary" disabled={submitting}>
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Submitting test...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-send-check" aria-hidden="true" /> Submit basic IT skills test
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : null}
          </div>

          <div className="col-12 col-xl-4">
            <div className="ss-sticky-panel">
              <div className="ss-help-card">
                <span className="ss-small-label dark">How this works</span>
                <ol>
                  <li>The applicant submits the registration form.</li>
                  <li>If the application moves to the next step, the system emails a private test link.</li>
                  <li>The link opens the Basic IT skills test and ties the result to the same applicant record.</li>
                  <li>The committee reviews registration details, documents, and the test result together.</li>
                </ol>
              </div>

              <div className="ss-help-card mt-4">
                <span className="ss-small-label dark">Important</span>
                <p className="mb-0">
                  The test can only be submitted once for the applicant. Re-opening the link after submission will show the saved result instead of a new test.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default SkillsTestPage;