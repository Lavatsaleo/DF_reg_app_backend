import ApplicationConfirmation from "../components/ApplicationConfirmation";
import FormProgress from "../components/FormProgress";
import RegistrationWizard from "../components/RegistrationWizard";

function RegistrationPage({
  selectedPathway,
  groupedQuestions,
  answers,
  documents,
  documentType,
  loadingQuestions,
  submitting,
  submitResult,
  errorMessage,
  fieldErrors,
  formProgress,
  draftLastSavedAt,
  draftReference,
  draftSaveStatus,
  draftSaveMessage,
  currentStep,
  onBackToPathways,
  onCheckStatus,
  onTakeSkillsTest,
  onAnswerChange,
  onMultiSelectChange,
  onSubmit,
  onValidateQuestions,
  onDocumentsChange,
  onDocumentTypeChange,
  onClearDraft,
  onStepChange,
}) {
  const sectionEntries = Object.entries(groupedQuestions);

  if (submitResult) {
    return (
      <ApplicationConfirmation
        result={submitResult}
        selectedPathway={selectedPathway}
        onStartNewApplication={onBackToPathways}
        onCheckStatus={onCheckStatus}
        onTakeSkillsTest={onTakeSkillsTest}
      />
    );
  }

  if (loadingQuestions) {
    return (
      <main id="main-content" tabIndex="-1" className="container py-5">
        <section className="ss-loading-card text-center" aria-live="polite">
          <div className="spinner-border" role="status" aria-hidden="true" />
          <h1>Loading {selectedPathway.title} registration form...</h1>
          <p>Please wait while we prepare the form.</p>
        </section>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex="-1">
      <section className="ss-form-hero" aria-labelledby="registration-title">
        <div className="container">
          <div className="row align-items-center g-4">
            <div className="col-12 col-lg-8">
              <button type="button" className="btn ss-btn-outline mb-4" onClick={onBackToPathways}>
                <i className="bi bi-arrow-left" aria-hidden="true" /> Back to pathways
              </button>
              <span className="ss-small-label light">Sightsavers Digital Futures</span>
              <h1 id="registration-title">{selectedPathway.title} Registration</h1>
              <p>
                A clean, fast application experience. Complete the required fields, review once, and submit. Eligibility screening runs quietly in the background after submission.
              </p>
            </div>

            <div className="col-12 col-lg-4">
              <div className="ss-selected-card" aria-label={`Selected pathway is ${selectedPathway.title}`}>
                <span>Selected pathway</span>
                <strong>{selectedPathway.title}</strong>
                <small>{selectedPathway.mode} workflow</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-5">
        <div className="row g-4 align-items-start">
          <div className="col-12 col-xl-8">
            <RegistrationWizard
              selectedPathway={selectedPathway}
              groupedQuestions={groupedQuestions}
              answers={answers}
              documents={documents}
              documentType={documentType}
              submitting={submitting}
              submitResult={submitResult}
              errorMessage={errorMessage}
              fieldErrors={fieldErrors}
              formProgress={formProgress}
              draftLastSavedAt={draftLastSavedAt}
              draftReference={draftReference}
              draftSaveStatus={draftSaveStatus}
              draftSaveMessage={draftSaveMessage}
              currentStep={currentStep}
              onAnswerChange={onAnswerChange}
              onMultiSelectChange={onMultiSelectChange}
              onSubmit={onSubmit}
              onValidateQuestions={onValidateQuestions}
              onDocumentsChange={onDocumentsChange}
              onDocumentTypeChange={onDocumentTypeChange}
              onClearDraft={onClearDraft}
              onStepChange={onStepChange}
            />
          </div>

          <div className="col-12 col-xl-4">
            <div className="ss-sticky-panel">
              <FormProgress
                progress={formProgress}
                sectionCount={sectionEntries.length}
                submitting={submitting}
              />

              <div className="ss-help-card mt-4">
                <span className="ss-small-label dark">Submit only once</span>
                <p className="mb-0">
                  Do not create another application using the same email address or phone number. If an application already exists, the system will open the existing application summary instead of creating another record.
                </p>
              </div>

              <div className="ss-help-card mt-4">
                <span className="ss-small-label dark">Better experience</span>
                <ol>
                  <li>Complete one section at a time.</li>
                  <li>Each section checks its own missing answers before you move on.</li>
                  <li>Review everything before final submission.</li>
                </ol>
              </div>

              <div className="ss-help-card mt-4">
                <span className="ss-small-label dark">Need help using the form?</span>
                <p className="mb-0">
                  Use the accessibility tools above to increase text size, switch to high contrast, reduce movement, or read the page aloud. Text fields also include a speak answer option where supported by your browser.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default RegistrationPage;
