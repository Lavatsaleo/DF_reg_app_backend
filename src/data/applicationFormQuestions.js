const physicalBaseQuestions = require("./physicalApplicationBaseQuestions");

const ENTRY_ONLY_CODES = new Set([
  "JURAT_REQUIRED",
  "JURAT_INTERPRETER_NAME",
  "JURAT_INTERPRETER_ADDRESS",
  "JURAT_LANGUAGE",
  "JURAT_INTERPRETER_SIGNATURE",
  "JURAT_DATE",
]);

const PHYSICAL_ONLY_CODES = new Set([
  "HEARD_ABOUT_PROJECT",
  "HEARD_ABOUT_PROJECT_OTHER",
]);

const sharedQuestions = physicalBaseQuestions.map((question) => {
  const next = { ...question };

  if (question.questionCode === "COURSE_APPLIED_FOR") {
    next.options = ["Physical Academy", "Virtual Academy"];
    next.helpText = "Captured automatically from the pathway selected on the landing page.";
  }

  if (question.questionCode === "TRAINING_AVAILABILITY") {
    next.questionText = "Are you available for the full duration of the selected training?";
    next.helpText = "You must be able to commit to the full training period for your selected pathway.";
    next.metadata = {
      ...(question.metadata || {}),
      labelByPathway: {
        "Physical Academy": "Are you available for the full duration of the Physical Academy training (9 months)?",
        "Virtual Academy": "Are you available for the full duration of the Virtual Academy training (4 months)?",
      },
      helpTextByPathway: {
        "Physical Academy": "The Physical Academy is a 9-month, face-to-face programme. Classes are expected to run Monday to Friday. You must be able to commit to the full training period.",
        "Virtual Academy": "The Virtual Academy is a 4-month online programme. You are expected to attend scheduled online sessions and complete the required learning activities throughout the full training period.",
      },
    };
  }

  if (ENTRY_ONLY_CODES.has(question.questionCode)) {
    next.hiddenFromApplicant = true;
  }

  if (PHYSICAL_ONLY_CODES.has(question.questionCode)) {
    next.showIf = {
      questionCode: "COURSE_APPLIED_FOR",
      operator: "equals",
      value: "Physical Academy",
    };
  }

  return next;
});

const contextualConsentQuestions = [
  {
    questionNumber: null,
    questionCode: "CONSENT_DETECTED_COUNTRY",
    questionText: "Country detected from current location at consent",
    section: "Consent Context",
    responseType: "TEXT",
    required: false,
    hiddenFromApplicant: true,
  },
  {
    questionNumber: null,
    questionCode: "CONSENT_CONTACT_CONTEXT",
    questionText: "Country contact context shown when consent was signed",
    section: "Consent Context",
    responseType: "TEXT",
    required: false,
    hiddenFromApplicant: true,
  },
  {
    questionNumber: null,
    questionCode: "CONSENT_CONTACTS_AT_SIGNING",
    questionText: "Country contacts displayed when consent was signed",
    section: "Consent Context",
    responseType: "LONG_TEXT",
    required: false,
    hiddenFromApplicant: true,
  },
];

const virtualAcademyQuestions = [
  {
    questionNumber: 49,
    questionCode: "DEVICE_ACCESS",
    questionText: "Which device do you have access to?",
    section: "Access to Device, Internet & Electricity",
    responseType: "MULTI_SELECT",
    required: false,
    options: ["Laptop/desktop", "Tablet", "Smartphone", "None"],
    metadata: { exclusiveOptions: ["None"], sourceQuestionNumber: 32 },
    showIf: { questionCode: "COURSE_APPLIED_FOR", operator: "equals", value: "Virtual Academy" },
  },
  {
    questionNumber: 50,
    questionCode: "INTERNET_RELIABILITY",
    questionText: "How reliable is your internet for ~10–15 hours of study per week?",
    section: "Access to Device, Internet & Electricity",
    responseType: "SINGLE_SELECT",
    required: false,
    options: ["Reliable daily", "On-and-off", "Rare/none"],
    metadata: { sourceQuestionNumber: 33 },
    showIf: { questionCode: "COURSE_APPLIED_FOR", operator: "equals", value: "Virtual Academy" },
  },
  {
    questionNumber: 51,
    questionCode: "POWER_SUPPLY_RELIABILITY",
    questionText: "Is your power supply consistent enough to support a fixed daily virtual training schedule?",
    section: "Access to Device, Internet & Electricity",
    responseType: "SINGLE_SELECT",
    required: true,
    options: ["Yes, reliably", "Sometimes – it varies by day", "Rarely – it is unpredictable", "No"],
    metadata: { sourceQuestionNumber: 34 },
    showIf: { questionCode: "COURSE_APPLIED_FOR", operator: "equals", value: "Virtual Academy" },
  },
  {
    questionNumber: 52,
    questionCode: "WEEKDAY_POWER_HOURS",
    questionText: "How many hours of total power (grid + generator + solar combined) do you typically have access to on a weekday?",
    section: "Access to Device, Internet & Electricity",
    responseType: "SINGLE_SELECT",
    required: false,
    options: ["Less than 2 hours", "2-6 hours", "6-12 hours", "12-18 hours", "18-24 hours"],
    metadata: { sourceQuestionNumber: 35 },
    showIf: { questionCode: "COURSE_APPLIED_FOR", operator: "equals", value: "Virtual Academy" },
  },
  {
    questionNumber: 53,
    questionCode: "ALTERNATIVE_POWER_LOCATION",
    questionText: "Is there a location outside your home where you can reliably access power for training? (e.g. business centre, library, co-working space)",
    section: "Access to Device, Internet & Electricity",
    responseType: "SINGLE_SELECT",
    required: false,
    options: ["Yes – within walking distance", "Yes – but it requires transport", "No"],
    metadata: { sourceQuestionNumber: 36 },
    showIf: { questionCode: "COURSE_APPLIED_FOR", operator: "equals", value: "Virtual Academy" },
  },
];

module.exports = [
  ...sharedQuestions,
  ...contextualConsentQuestions,
  ...virtualAcademyQuestions,
];
