import QuestionField from "./QuestionField";

function FormSection({
  section,
  questions,
  answers,
  errors,
  hideHeader = false,
  onAnswerChange,
  onMultiSelectChange,
}) {
  const sectionId = `section-${section}`.replace(/[^a-zA-Z0-9-_]/g, "-");

  return (
    <section className={hideHeader ? "ss-section-card embedded" : "ss-section-card"} aria-labelledby={sectionId}>
      {!hideHeader && (
        <div className="ss-section-header">
          <div>
            <span className="ss-step-pill">Section</span>
            <h2 id={sectionId}>{section}</h2>
          </div>
          <span className="ss-count-badge">Quick step</span>
        </div>
      )}

      {hideHeader && <h3 id={sectionId} className="visually-hidden">{section}</h3>}

      <div className="row g-3 g-lg-4 ss-polished-question-row">
        {questions.map((question) => {
          const error = errors?.[question.questionCode];
          const labelId = `${question.questionCode}-label`;
          const helpId = question.helpText ? `${question.questionCode}-help` : undefined;
          const errorId = `${question.questionCode}-error`;
          const isWideQuestion = question.questionCode === "DATE_OF_BIRTH";

          return (
            <div key={question.questionCode} className={isWideQuestion ? "col-12" : "col-12 col-lg-6"}>
              <div className={`ss-question-card h-100 ${isWideQuestion ? "wide" : ""} ${error ? "has-error" : ""}`} id={`${question.questionCode}-card`}>
                <label className="form-label" htmlFor={question.questionCode} id={labelId}>
                  <span>{question.questionText}</span>
                  {question.required ? (
                    <strong className="ss-required-chip" aria-label="Required field">Required</strong>
                  ) : (
                    <em className="ss-optional-chip">Optional</em>
                  )}
                </label>

                {question.helpText && (
                  <p id={helpId} className="ss-question-help">
                    {question.helpText}
                  </p>
                )}

                <QuestionField
                  question={question}
                  value={answers[question.questionCode]}
                  answers={answers}
                  error={error}
                  labelId={labelId}
                  helpId={helpId}
                  errorId={errorId}
                  onAnswerChange={onAnswerChange}
                  onMultiSelectChange={onMultiSelectChange}
                />

                {error && (
                  <div id={errorId} className="invalid-feedback d-block" role="alert">
                    {error}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default FormSection;
