import { useEffect, useMemo, useState } from "react";
import DocumentUploadSection from "./DocumentUploadSection";
import FormErrorSummary from "./FormErrorSummary";
import ResultAlert from "./ResultAlert";
import ReviewApplication from "./ReviewApplication";
import WizardSection from "./WizardSection";

function isEmpty(value) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function getSectionStatus(questions, answers, errors, isActive) {
  const hasErrors = questions.some((question) => errors?.[question.questionCode]);
  if (hasErrors) return "needs_attention";

  const requiredQuestions = questions.filter((question) => question.required);
  const answeredRequired = requiredQuestions.filter((question) => !isEmpty(answers[question.questionCode]));
  const answeredAny = questions.some((question) => !isEmpty(answers[question.questionCode]));

  if (requiredQuestions.length > 0 && answeredRequired.length === requiredQuestions.length) return "complete";
  if (requiredQuestions.length === 0 && answeredAny) return "complete";
  if (isActive || answeredAny) return "in_progress";
  return "not_started";
}

function formatSavedTime(timestamp) {
  if (!timestamp) return "Not saved yet";

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "Saved";
  }
}

function RegistrationWizard({
  selectedPathway,
  groupedQuestions,
  answers,
  documents,
  documentType,
  submitting,
  submitResult,
  errorMessage,
  fieldErrors,
  formProgress,
  draftLastSavedAt,
  onAnswerChange,
  onMultiSelectChange,
  onSubmit,
  onValidateQuestions,
  onDocumentsChange,
  onDocumentTypeChange,
  onClearDraft,
}) {
  const sectionEntries = useMemo(() => Object.entries(groupedQuestions), [groupedQuestions]);
  const documentStepIndex = sectionEntries.length;
  const reviewStepIndex = sectionEntries.length + 1;
  const totalSteps = sectionEntries.length + 2;
  const [activeStep, setActiveStep] = useState(0);
  const [announcement, setAnnouncement] = useState("Start with the first section of the registration form.");

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (activeStep > reviewStepIndex) {
      setActiveStep(0);
    }
  }, [activeStep, reviewStepIndex]);

  useEffect(() => {
    const errorCodes = Object.keys(fieldErrors || {});
    if (errorCodes.length === 0 || sectionEntries.length === 0) return;

    const firstErrorSectionIndex = sectionEntries.findIndex(([, questions]) =>
      questions.some((question) => errorCodes.includes(question.questionCode))
    );

    if (firstErrorSectionIndex >= 0) {
      setActiveStep(firstErrorSectionIndex);
      setAnnouncement("Some questions need attention. The first section with an error is now open.");
    }
  }, [fieldErrors, sectionEntries]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function goToStep(stepIndex) {
    const nextStep = Math.max(0, Math.min(stepIndex, reviewStepIndex));
    setActiveStep(nextStep);

    window.requestAnimationFrame(() => {
      const panel = document.querySelector(`#wizard-step-${nextStep}`) || document.querySelector(".ss-registration-wizard");
      panel?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function continueFromSection(index, questions) {
    const isValid = onValidateQuestions(questions);

    if (!isValid) {
      setAnnouncement("Please complete the highlighted questions before continuing.");
      return;
    }

    const nextStep = Math.min(index + 1, reviewStepIndex);
    setAnnouncement(`Section completed. Moving to step ${nextStep + 1} of ${totalSteps}.`);
    goToStep(nextStep);
  }

  function handleSubmit(event) {
    onSubmit(event);
  }

  if (sectionEntries.length === 0) {
    return (
      <section className="ss-section-card">
        <div className="ss-empty-state">
          <i className="bi bi-ui-checks" aria-hidden="true" />
          <h2>No questions are currently available</h2>
          <p>The form loaded successfully, but no questions were returned by the backend.</p>
        </div>
      </section>
    );
  }

  return (
    <form className="ss-form-shell ss-registration-wizard" onSubmit={handleSubmit} noValidate aria-describedby="registration-form-guidance">
      <p id="registration-form-guidance" className="visually-hidden">
        This is a guided step-by-step form. Fields marked with an asterisk are required. Use the Save and continue button to move through each section.
      </p>

      <div className="ss-wizard-topper ss-executive-wizard-topper">
        <div>
          <span className="ss-small-label dark">Fast guided application</span>
          <h2>{selectedPathway.title} Registration</h2>
          <p>
            A guided accessible application. Complete the required fields, review once, and submit.
          </p>
          <div className="ss-quick-facts" aria-label="Application summary">
            <span><i className="bi bi-clock" aria-hidden="true" /> About 10–15 minutes</span>
            <span><i className="bi bi-shield-check" aria-hidden="true" /> One application per person</span>
            <span><i className="bi bi-envelope-check" aria-hidden="true" /> Test link sent if eligible</span>
          </div>
        </div>

        <div className="ss-draft-status" aria-live="polite">
          <i className="bi bi-cloud-check" aria-hidden="true" />
          <span>Draft saved: {formatSavedTime(draftLastSavedAt)}</span>
          <button type="button" className="btn btn-sm ss-link-button" onClick={onClearDraft}>
            Clear
          </button>
        </div>
      </div>

      <div className="ss-wizard-progress" aria-label={`Step ${activeStep + 1} of ${totalSteps}`}>
        <div className="ss-wizard-progress-meta">
          <span>Step {activeStep + 1} of {totalSteps}</span>
          <span>{formProgress.completedRequired}/{formProgress.totalRequired} required fields completed</span>
        </div>
        <div className="progress ss-progress-bar" role="progressbar" aria-valuenow={formProgress.percentage} aria-valuemin="0" aria-valuemax="100">
          <div className="progress-bar" style={{ width: `${formProgress.percentage}%` }} />
        </div>
      </div>

      <div className="visually-hidden" aria-live="polite">{announcement}</div>

      <FormErrorSummary errors={fieldErrors} />

      {errorMessage && (
        <div className="alert ss-alert-error" role="alert">
          <i className="bi bi-exclamation-triangle" aria-hidden="true" /> {errorMessage}
        </div>
      )}

      <ResultAlert result={submitResult} />

      <div className="ss-wizard-stack">
        {sectionEntries.map(([section, sectionQuestions], index) => {
          const isActive = activeStep === index;
          const status = getSectionStatus(sectionQuestions, answers, fieldErrors, isActive);

          return (
            <div id={`wizard-step-${index}`} key={section}>
              <WizardSection
                index={index}
                title={section}
                questions={sectionQuestions}
                status={status}
                isActive={isActive}
                answers={answers}
                errors={fieldErrors}
                onToggle={() => goToStep(index)}
                onPrevious={() => goToStep(index - 1)}
                onContinue={() => continueFromSection(index, sectionQuestions)}
                onAnswerChange={onAnswerChange}
                onMultiSelectChange={onMultiSelectChange}
              />
            </div>
          );
        })}

        <div id={`wizard-step-${documentStepIndex}`}>
          <DocumentUploadSection
            stepNumber={documentStepIndex + 1}
            totalSteps={totalSteps}
            isActive={activeStep === documentStepIndex}
            documents={documents}
            documentType={documentType}
            onToggle={() => goToStep(documentStepIndex)}
            onPrevious={() => goToStep(documentStepIndex - 1)}
            onContinue={() => goToStep(reviewStepIndex)}
            onDocumentsChange={onDocumentsChange}
            onDocumentTypeChange={onDocumentTypeChange}
          />
        </div>

        <div id={`wizard-step-${reviewStepIndex}`}>
          <ReviewApplication
            stepNumber={reviewStepIndex + 1}
            totalSteps={totalSteps}
            isActive={activeStep === reviewStepIndex}
            sectionEntries={sectionEntries}
            answers={answers}
            documents={documents}
            documentType={documentType}
            submitting={submitting}
            onToggle={() => goToStep(reviewStepIndex)}
            onPrevious={() => goToStep(reviewStepIndex - 1)}
            onEditSection={goToStep}
          />
        </div>
      </div>
    </form>
  );
}

export default RegistrationWizard;
