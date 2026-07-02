import FormSection from "./FormSection";

const SECTION_META = {
  Location: {
    icon: "bi-geo-alt",
    caption: "Where you are applying from",
    intro: "",
  },
  "Personal Details": {
    icon: "bi-person-badge",
    caption: "Identity, contact, age and household details",
    intro: "Provide your identity, contact, age and demographic details. Applicants must be 18 to 33 years old at the point of registration.",
  },
  "Training Commitment": {
    icon: "bi-calendar-check",
    caption: "Training availability",
    intro: "Confirm that you are available for the expected training period before continuing.",
  },
  "Age and Demographics": {
    icon: "bi-person-lines-fill",
    caption: "Age and household profile",
    intro: "Applicants must be 18 to 33 years old at the point of registration. If you know your birth year, only eligible years are shown; if you are not sure, enter your age at last birthday.",
  },
  "Education and Training": {
    icon: "bi-mortarboard",
    caption: "Education background and training availability",
    intro: "Confirm your availability for the expected training period, then tell us about your education and any training you are currently undertaking.",
  },
  "Disability and Support": {
    icon: "bi-universal-access-circle",
    caption: "Eligibility and accessibility support",
    intro: "These answers help the system run the first screening and help the team plan reasonable accommodation support.",
  },
  "Digital Access": {
    icon: "bi-laptop",
    caption: "Online learning readiness",
    intro: "These questions appear only for the Virtual Academy pathway.",
  },
  Application: {
    icon: "bi-ui-checks",
    caption: "Motivation and project awareness",
    intro: "Tell us how you heard about the project and why the training is important for your goals.",
  },
  "Employment Status and Career Goals": {
    icon: "bi-briefcase",
    caption: "Work status and aspirations",
    intro: "Share your current employment situation and the type of work or business pathway you are aiming for.",
  },
  "Trusted Contact": {
    icon: "bi-telephone-forward",
    caption: "Backup contact for follow-up",
    intro: "Provide a trusted contact in case the project team cannot reach you on your own number.",
  },
  "Final Step": {
    icon: "bi-check2-square",
    caption: "Source and consent",
    intro: "Finish with how you heard about the project and confirm consent so we can process the application.",
  },
  Consent: {
    icon: "bi-check2-square",
    caption: "Confirm consent",
    intro: "Consent is required before submission. It is not used as an eligibility score.",
  },
  "Consent and Submission": {
    icon: "bi-check2-square",
    caption: "Final confirmation",
    intro: "Confirm consent so that the project team can process and review your application.",
  },
};

function statusLabel(status) {
  if (status === "complete") return "Done";
  if (status === "needs_attention") return "Check";
  if (status === "in_progress") return "Open";
  return "Next";
}

function statusIcon(status) {
  if (status === "complete") return "bi-check2";
  if (status === "needs_attention") return "bi-exclamation-triangle";
  if (status === "in_progress") return "bi-pencil";
  return "bi-arrow-right";
}

function getSectionMeta(title) {
  return SECTION_META[title] || {
    icon: "bi-ui-checks-grid",
    caption: "Quick application step",
    intro: "Complete this step, then continue. Required fields are checked before you move forward.",
  };
}

function WizardSection({
  index,
  title,
  questions,
  status,
  isActive,
  answers,
  errors,
  onToggle,
  onPrevious,
  onContinue,
  onAnswerChange,
  onMultiSelectChange,
}) {
  const panelId = `wizard-section-panel-${index}`;
  const buttonId = `wizard-section-button-${index}`;
  const describedById = `wizard-section-desc-${index}`;
  const sectionMeta = getSectionMeta(title);
  const requiredCount = questions.filter((question) => question.required).length;

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
            <i className={`bi ${sectionMeta.icon}`} />
          </span>
          <span className="ss-wizard-step-copy">
            <span>{title}</span>
            <small id={describedById}>{sectionMeta.caption} · {requiredCount} required</small>
          </span>
          <span className={`ss-wizard-status-badge ${status}`}>
            <i className={`bi ${statusIcon(status)}`} aria-hidden="true" />
            {statusLabel(status)}
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
        {sectionMeta.intro && (
          <div className="ss-wizard-section-intro">
            <p>{sectionMeta.intro}</p>
          </div>
        )}

        <FormSection
          section={title}
          questions={questions}
          answers={answers}
          errors={errors}
          hideHeader
          onAnswerChange={onAnswerChange}
          onMultiSelectChange={onMultiSelectChange}
        />

        <div className="ss-wizard-actions">
          <button
            type="button"
            className="btn ss-btn-outline"
            onClick={onPrevious}
            disabled={index === 0}
          >
            <i className="bi bi-arrow-left" aria-hidden="true" /> Previous
          </button>

          <button type="button" className="btn ss-btn-primary" onClick={onContinue}>
            Continue <i className="bi bi-arrow-right" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

export default WizardSection;
