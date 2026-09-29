const {
  COUNTRIES,
  COUNTRY_DIAL_CODES,
  KENYA_COUNTIES,
  GHANA_REGIONS,
  STATE_OPTIONS_BY_COUNTRY,
  DISTRICT_OPTIONS_BY_COUNTRY_AND_PARENT,
  LOCATION_HIERARCHY,
} = require("./administrativeLocations");

/*
 * Digital Futures application forms — FINAL V4
 * Source files received 29 September 2026:
 *  - Physical Academy V4-reviewed
 *  - Virtual Academy V4-reviewed
 *  - Digital Entrepreneurship V4
 *
 * Applicant-facing wording follows the supplied forms. Where the source's
 * skip-logic references conflict with its option numbering, the condition is
 * implemented against the named answer ("Yes" / "Other") so the intended
 * conditional field works.
 */

const FORM_VERSIONS = {
  PHYSICAL_ACADEMY: "DF-01-PHYSICAL-ACADEMY-V4-2026-09-29",
  VIRTUAL_ACADEMY: "DF-01-VIRTUAL-ACADEMY-V4-2026-09-29",
  DIGITAL_ENTREPRENEURSHIP: "DF-01-DIGITAL-ENTREPRENEURSHIP-V4-2026-09-29",
};

const PATHWAY_TITLES = {
  PHYSICAL_ACADEMY: "Physical Academy",
  VIRTUAL_ACADEMY: "Virtual Academy",
  DIGITAL_ENTREPRENEURSHIP: "Digital Entrepreneurship",
};

const EDUCATION_OPTIONS = [
  "No Education",
  "Pre-Primary",
  "Primary",
  "Secondary /",
  "Junior Secondary",
  "Certificate / Vocational / TVET",
  "Diploma /Ordinary National Diploma (OND)",
  "Highter National Diploma (HND)",
  "Bachelor's degree",
  "Postgraduate",
  "Other",
];

const EDUCATION_COURSE_LEVELS = [
  "Certificate / Vocational / TVET",
  "Diploma /Ordinary National Diploma (OND)",
  "Highter National Diploma (HND)",
  "Bachelor's degree",
  "Postgraduate",
];

const DISABILITY_OPTIONS = [
  "Physical disability (mobility impairments, short stature, cerebral palsy, spina bifida)",
  "Blind",
  "Low vision",
  "Deaf",
  "Hard of hearing",
  "Deaf-blindness",
  "Speech or communication disability",
  "Intellectual disability (incl. Down Syndrome)",
  "Neurodiverse (incl. Autism, ADHD, dyslexia, epilepsy, learning disabilities)",
  "Psychosocial disability",
  "Albinism",
  "Other",
];

const ACCESSIBILITY_OPTIONS = [
  "Sign language interpreter",
  "Video captions",
  "Screen reader",
  "Large print",
  "Soft copy material (e.g. slides sent before a presentation)",
  "Braille materials",
  "Firm and non-slip floors",
  "Proper lighting",
  "Wheelchair-accessible environment (adequate spacing, accessible washrooms)",
  "Support person (additional support to understand learning material)",
  "Additional time",
  "Flexible time",
  "Other",
];

const PREVIOUS_TRAINING_OPTIONS = [
  "Sightsavers project Accenture/Fundaula Skills to Succeed (S2S) employability soft skills training online",
  "Instructor led (in person) employability soft skills training through Sightsavers project",
  "Sightsavers IT Bridge Academy CCNA",
  "Sightsavers IT Bridge Academy CCST",
  "Entrepreneurship training (in person) through Sightsavers project",
  "Mentoring through Sightsavers project",
  "Internship/work experience placement facilitated through Sightsavers project",
  "Other",
];

const ENTREPRENEURSHIP_PREVIOUS_TRAINING_OPTIONS = [
  ...PREVIOUS_TRAINING_OPTIONS.slice(0, 7),
  "Other (allow free text response for the detail)",
];

const CONTACT_METHOD_OPTIONS = [
  "Voice call",
  "SMS",
  "WhatsApp text",
  "WhatsApp video",
  "WhatsApp call",
  "Email",
  "Other",
];

const PHONE_HELP =
  "Kenya: 10 digits starting 01 or 07, or +254 followed by 9 digits. Nigeria: 11 digits starting 070, 080, 081, 090 or 091, or +234 followed by 10 digits. Zambia: 10 digits starting 09, or +260 followed by 9 digits. Ghana: 10 digits starting 02, 05 or 03, or +233 followed by 9 digits.";

const PHONE_PATTERNS = {
  Kenya: "^(?:0?(?:1|7)\\d{8})$",
  Nigeria: "^(?:0?(?:70|80|81|90|91)\\d{8})$",
  Zambia: "^(?:0?9\\d{8})$",
  Ghana: "^(?:0?(?:2|3|5)\\d{8})$",
};

const NATIONAL_ID_HELP =
  "Kenya: National ID (8 digits) or passport number. Nigeria: NIN (11 digits) or passport number. Zambia: NRC or passport number (allow slashes/letters).";

const ID_TYPE_OPTIONS = [
  "Ghana Card / National Identification Number (NIN)",
  "Voter’s ID Card",
  "NHIS Card",
  "Driver’s Licence",
  "Passport",
];

function setupQuestions(pathway) {
  return [
    {
      questionNumber: null,
      questionCode: "COURSE_APPLIED_FOR",
      questionText: "Digital Futures pathway",
      section: "Application Setup",
      responseType: "SINGLE_SELECT",
      required: false,
      hiddenFromApplicant: true,
      options: [PATHWAY_TITLES[pathway]],
    },
    {
      questionNumber: null,
      questionCode: "REGISTRATION_CONSENT",
      questionText: "Do you consent to the collection and use of your information as described above?",
      section: "Consent",
      responseType: "SINGLE_SELECT",
      required: false,
      hiddenFromApplicant: true,
      options: ["Yes, I consent", "No, I do NOT consent"],
    },
  ];
}

function locationQuestions({ countryNumber, levelOneNumber, levelTwoNumber, townNumber, section, countryHelp }) {
  return [
    {
      questionNumber: countryNumber,
      questionCode: "COUNTRY",
      questionText: "Country",
      section,
      responseType: "SINGLE_SELECT",
      required: true,
      options: COUNTRIES,
      helpText: countryHelp || "",
      metadata: { dialCodes: COUNTRY_DIAL_CODES, locationHierarchy: LOCATION_HIERARCHY },
    },
    {
      questionNumber: levelOneNumber,
      questionCode: "COUNTY",
      questionText: "County / Region",
      section,
      responseType: "SINGLE_SELECT",
      required: true,
      options: KENYA_COUNTIES,
      showIf: { questionCode: "COUNTRY", operator: "equals", value: "Kenya" },
    },
    {
      questionNumber: levelOneNumber,
      questionCode: "STATE",
      questionText: "County / Region",
      section,
      responseType: "SINGLE_SELECT",
      required: true,
      options: [],
      metadata: { optionsByCountry: STATE_OPTIONS_BY_COUNTRY },
      showIf: { questionCode: "COUNTRY", operator: "in", value: ["Nigeria", "Zambia"] },
    },
    {
      questionNumber: levelOneNumber,
      questionCode: "REGION",
      questionText: "County / Region",
      section,
      responseType: "SINGLE_SELECT",
      required: true,
      options: GHANA_REGIONS,
      showIf: { questionCode: "COUNTRY", operator: "equals", value: "Ghana" },
    },
    {
      questionNumber: levelTwoNumber,
      questionCode: "SUB_COUNTY",
      questionText: "Ward",
      section,
      responseType: "SINGLE_SELECT",
      required: true,
      options: [],
      metadata: {
        parentQuestionCode: "COUNTY",
        optionsByParent: LOCATION_HIERARCHY.Kenya.children,
        emptyOptionLabel: "Select County / Region first",
      },
      showIf: { questionCode: "COUNTRY", operator: "equals", value: "Kenya" },
    },
    {
      questionNumber: levelTwoNumber,
      questionCode: "DISTRICT",
      questionText: "Ward",
      section,
      responseType: "SINGLE_SELECT",
      required: true,
      options: [],
      metadata: {
        optionsByCountryAndParent: DISTRICT_OPTIONS_BY_COUNTRY_AND_PARENT,
        emptyOptionLabelByCountry: {
          Nigeria: "Select County / Region first",
          Ghana: "Select County / Region first",
          Zambia: "Select County / Region first",
        },
      },
      showIf: { questionCode: "COUNTRY", operator: "in", value: ["Nigeria", "Ghana", "Zambia"] },
    },
    {
      questionNumber: townNumber,
      questionCode: "TOWN",
      questionText: "Town",
      section,
      responseType: "TEXT",
      required: true,
    },
  ];
}

function identityQuestions({
  firstNameNumber,
  middleNameNumber,
  lastNameNumber,
  sexNumber,
  dobNumber,
  nationalIdNumber,
  idTypeNumber,
  cardNumber,
  phoneNumber,
  alternativePhoneNumber,
  emailNumber,
  contactMethodNumber,
  contactOtherNumber,
  section,
  ageMax,
}) {
  return [
    {
      questionNumber: firstNameNumber,
      questionCode: "FIRST_NAME",
      questionText: "First Name",
      section,
      responseType: "TEXT",
      required: true,
      validationType: "PERSON_NAME",
      helpText: `Q${firstNameNumber}–Q${lastNameNumber}: enter exactly as shown on the national ID or birth certificate.`,
    },
    {
      questionNumber: middleNameNumber,
      questionCode: "MIDDLE_NAME",
      questionText: "Middle Name",
      section,
      responseType: "TEXT",
      required: false,
      validationType: "PERSON_NAME",
    },
    {
      questionNumber: lastNameNumber,
      questionCode: "LAST_NAME",
      questionText: "Last / Surname",
      section,
      responseType: "TEXT",
      required: true,
      validationType: "PERSON_NAME",
    },
    {
      questionNumber: sexNumber,
      questionCode: "SEX",
      questionText: "Sex",
      section,
      responseType: "SINGLE_SELECT",
      required: true,
      options: ["Female", "Male"],
    },
    {
      questionNumber: dobNumber,
      questionCode: "DATE_OF_BIRTH",
      questionText: "Date of birth",
      section,
      responseType: "DATE",
      required: true,
      isEligibilityQuestion: true,
      metadata: {
        minEligibleAge: 18,
        maxEligibleAge: ageMax,
        ageOutOfRangeAction: "review",
      },
      helpText: ageMax === 45
        ? "Eligibility: 18–45years, unless programme rules specify otherwise. Flag out-of-range applicants for review."
        : "Eligibility: 18–35 years, unless programme rules specify otherwise. Flag out-of-range applicants for review.",
    },
    {
      questionNumber: nationalIdNumber,
      questionCode: "NATIONAL_ID_NUMBER",
      questionText: nationalIdNumber === 19 ? "National ID /" : "National ID number",
      section,
      responseType: "TEXT",
      required: true,
      validationType: "IDENTIFICATION",
      helpText: `Text/number entry only  a supporting document upload is not yet confirmed for this field (pending country-team decision). ${NATIONAL_ID_HELP}`,
      showIf: { questionCode: "COUNTRY", operator: "in", value: ["Kenya", "Nigeria", "Zambia"] },
    },
    {
      questionNumber: idTypeNumber,
      questionCode: "NATIONAL_ID_TYPE",
      questionText: "Type of national identification provided [GHANA & NIGERIA ONLY]",
      section,
      responseType: "SINGLE_SELECT",
      required: true,
      options: ID_TYPE_OPTIONS,
      showIf: { questionCode: "COUNTRY", operator: "in", value: ["Ghana", "Nigeria"] },
    },
    {
      questionNumber: cardNumber,
      questionCode: "NATIONAL_ID_CARD_NUMBER",
      questionText: "Enter the card identification number",
      section,
      responseType: "TEXT",
      required: true,
      validationType: "CARD_IDENTIFICATION",
      helpText: "ALPHANUMERIC. If Ghana Card, then 15 characters and begins with “GHA- “. If Nigeria, NIN is 11 digits all Numeric.",
      metadata: { idTypeQuestionCode: "NATIONAL_ID_TYPE" },
      showIf: { questionCode: "COUNTRY", operator: "in", value: ["Ghana", "Nigeria"] },
    },
    {
      questionNumber: phoneNumber,
      questionCode: "CONTACT_NUMBER",
      questionText: "Primary phone number",
      section,
      responseType: "PHONE",
      required: true,
      validationType: "COUNTRY_PHONE",
      helpText: PHONE_HELP,
      metadata: { phonePatternsByCountry: PHONE_PATTERNS },
    },
    {
      questionNumber: alternativePhoneNumber,
      questionCode: "ALTERNATIVE_CONTACT_NUMBER",
      questionText: "Alternative phone (spouse, parent or sibling)",
      section,
      responseType: "PHONE",
      required: false,
      validationType: "COUNTRY_PHONE",
      helpText: PHONE_HELP,
      metadata: { phonePatternsByCountry: PHONE_PATTERNS },
    },
    {
      questionNumber: emailNumber,
      questionCode: "EMAIL",
      questionText: "Email address",
      section,
      responseType: "EMAIL",
      required: true,
    },
    {
      questionNumber: contactMethodNumber,
      questionCode: "PREFERRED_CONTACT_METHOD",
      questionText: "Preferred contact method / communication accommodation",
      section,
      responseType: "SINGLE_SELECT",
      required: true,
      options: CONTACT_METHOD_OPTIONS,
    },
    {
      questionNumber: contactOtherNumber,
      questionCode: "PREFERRED_CONTACT_METHOD_OTHER",
      questionText: "If Other, please specify",
      section,
      responseType: "TEXT",
      required: true,
      showIf: { questionCode: "PREFERRED_CONTACT_METHOD", operator: "equals", value: "Other" },
    },
  ];
}

function educationQuestions({ educationNumber, otherNumber, courseNumber, section, markEligibility = true }) {
  return [
    {
      questionNumber: educationNumber,
      questionCode: "EDUCATION_LEVEL",
      questionText: "What is the highest level of education you have completed?",
      section,
      responseType: "SINGLE_SELECT",
      required: true,
      isEligibilityQuestion: markEligibility,
      options: EDUCATION_OPTIONS,
      helpText: '"Certificate" = post-secondary/vocational (e.g. TVET). Coding a primary-level certificate is pending team discussion. NIGERIA – Selection starts from HND, BSC & Postgraduate',
    },
    {
      questionNumber: otherNumber,
      questionCode: "EDUCATION_LEVEL_OTHER",
      questionText: "If Other, please specify",
      section,
      responseType: "TEXT",
      required: true,
      showIf: { questionCode: "EDUCATION_LEVEL", operator: "equals", value: "Other" },
    },
    {
      questionNumber: courseNumber,
      questionCode: "COURSE_STUDIED",
      questionText: 'What course did you study in university/college? (State the full qualification title exactly as on your certificate/transcript, e.g. "BA in History".)',
      section,
      responseType: "TEXT",
      required: true,
      showIf: { questionCode: "EDUCATION_LEVEL", operator: "in", value: EDUCATION_COURSE_LEVELS },
    },
  ];
}

function disabilityQuestions({ disabilityNumber, typeNumber, otherTypeNumber, accessibilityNumber, accessibilityOtherNumber, section }) {
  return [
    {
      questionNumber: disabilityNumber,
      questionCode: "HAS_DISABILITY",
      questionText: "Do you consider yourself to have a disability?",
      section,
      responseType: "BOOLEAN",
      required: true,
      isEligibilityQuestion: true,
      options: ["Yes", "No"],
    },
    {
      questionNumber: typeNumber,
      questionCode: "DISABILITY_TYPE",
      questionText: "Sightsavers aims to ensure that diverse people with disabilities are represented in our programmes. Please state your disability type (you can choose multiple).",
      section,
      responseType: "MULTI_SELECT",
      required: true,
      options: DISABILITY_OPTIONS,
      showIf: { questionCode: "HAS_DISABILITY", operator: "equals", value: "Yes" },
    },
    {
      questionNumber: otherTypeNumber,
      questionCode: "OTHER_DISABILITY_TYPE",
      questionText: "If Other, please specify",
      section,
      responseType: "TEXT",
      required: true,
      showIf: { questionCode: "DISABILITY_TYPE", operator: "contains", value: "Other" },
    },
    {
      questionNumber: accessibilityNumber,
      questionCode: "ACCESSIBILITY_NEEDS",
      questionText: "Sightsavers aims to ensure that people with diverse disabilities are supported to complete the programme equitably. Do you have any accessibility requirements for which you require additional support?",
      section,
      responseType: "MULTI_SELECT",
      required: false,
      options: ACCESSIBILITY_OPTIONS,
      helpText: "This question does not inform selection it is for understanding support needs and planning reasonable adjustments.",
    },
    {
      questionNumber: accessibilityOtherNumber,
      questionCode: "ACCESSIBILITY_NEEDS_OTHER",
      questionText: "If Other, please specify",
      section,
      responseType: "TEXT",
      required: true,
      showIf: { questionCode: "ACCESSIBILITY_NEEDS", operator: "contains", value: "Other" },
    },
  ];
}

function priorEngagementQuestions({ participatedNumber, trainingNumber, otherNumber, section, entrepreneurship = false }) {
  const otherOption = entrepreneurship ? "Other (allow free text response for the detail)" : "Other";

  return [
    {
      questionNumber: participatedNumber,
      questionCode: "PREVIOUS_SIGHTSAVERS_TRAINING",
      questionText: "Have you participated in any Sightsavers' trainings?",
      section,
      responseType: "BOOLEAN",
      required: true,
      options: ["Yes", "No"],
    },
    {
      questionNumber: trainingNumber,
      questionCode: "PREVIOUS_SIGHTSAVERS_TRAINING_TYPES",
      questionText: "If yes, what trainings have you participated in? (select all that apply)",
      section,
      responseType: "MULTI_SELECT",
      required: true,
      options: entrepreneurship ? ENTREPRENEURSHIP_PREVIOUS_TRAINING_OPTIONS : PREVIOUS_TRAINING_OPTIONS,
      showIf: { questionCode: "PREVIOUS_SIGHTSAVERS_TRAINING", operator: "equals", value: "Yes" },
    },
    {
      questionNumber: otherNumber,
      questionCode: "PREVIOUS_SIGHTSAVERS_TRAINING_OTHER",
      questionText: "If Other, please specify",
      section,
      responseType: "TEXT",
      required: true,
      showIf: { questionCode: "PREVIOUS_SIGHTSAVERS_TRAINING_TYPES", operator: "contains", value: otherOption },
    },
  ];
}

const PHYSICAL_SECTION_1 = "Section 1: Training pathway selection";
const PERSONAL_SECTION = "Section 2: Personal & contact details";
const EDUCATION_SECTION = "Section 3: Education";
const DISABILITY_SECTION = "Section 4: Disability, accessibility & health";
const PRIOR_SECTION = "Section 5: Prior engagement with Sightsavers.";
const MOTIVATION_SECTION = "Section 6: Motivation & training readiness";
const VIRTUAL_ACCESS_SECTION = "Section 6: Access to device, internet and electricity";

const physicalQuestions = [
  ...setupQuestions("PHYSICAL_ACADEMY"),
  {
    questionNumber: 1,
    questionCode: "TRAINING_AVAILABILITY",
    questionText: "Are you available to participate in a nine-month residential training programme?",
    section: PHYSICAL_SECTION_1,
    responseType: "BOOLEAN",
    required: true,
    options: ["Yes", "No"],
    helpText: "Please note that you will be required to attend in-person classes at the training institute for the full nine months.",
    metadata: {
      sectionIntro: "The questions in this section ask about the training programme you would like to join and your availability to participate",
    },
  },
  {
    questionNumber: 2,
    questionCode: "ACCOMMODATION_REQUIRED",
    questionText: "Do you require accommodation at the training institute?",
    section: PHYSICAL_SECTION_1,
    responseType: "BOOLEAN",
    required: true,
    options: ["Yes", "No"],
  },
  ...locationQuestions({
    countryNumber: 3,
    levelOneNumber: 4,
    levelTwoNumber: 5,
    townNumber: 6,
    section: PERSONAL_SECTION,
    countryHelp: "Ask all. Drives the country-specific formats used at Qs 12 - 16.",
  }).map((question, index) => ({
    ...question,
    metadata: {
      ...(question.metadata || {}),
      ...(index === 0 ? {
        sectionIntro: "The questions in this section ask about who you are, where you live and how we can contact you about your application and the programme",
        sectionNotice: "You will be required to submit supporting documents during the verification process. The specific documents required will depend on the selected pathway, country requirements, and eligibility checks.",
      } : {}),
    },
  })),
  ...identityQuestions({
    firstNameNumber: 7,
    middleNameNumber: 8,
    lastNameNumber: 9,
    sexNumber: 10,
    dobNumber: 11,
    nationalIdNumber: 12,
    idTypeNumber: 13,
    cardNumber: 14,
    phoneNumber: 15,
    alternativePhoneNumber: 16,
    emailNumber: 17,
    contactMethodNumber: 18,
    contactOtherNumber: 19,
    section: PERSONAL_SECTION,
    ageMax: 35,
  }),
  ...educationQuestions({
    educationNumber: 20,
    otherNumber: 21,
    courseNumber: 22,
    section: EDUCATION_SECTION,
  }).map((question, index) => ({
    ...question,
    metadata: {
      ...(question.metadata || {}),
      ...(index === 0 ? {
        sectionIntro: "The questions in this section ask about your educational background and any qualifications you have completed",
      } : {}),
    },
  })),
  ...disabilityQuestions({
    disabilityNumber: 23,
    typeNumber: 24,
    otherTypeNumber: 25,
    accessibilityNumber: 26,
    accessibilityOtherNumber: 27,
    section: DISABILITY_SECTION,
  }).map((question, index) => ({
    ...question,
    metadata: {
      ...(question.metadata || {}),
      ...(index === 0 ? {
        sectionIntro: "The questions in this section ask about disability, accessibility and support requirements so that we can better understand participants' needs and make the programme as accessible as possible",
      } : {}),
    },
  })),
  ...priorEngagementQuestions({
    participatedNumber: 28,
    trainingNumber: 29,
    otherNumber: 30,
    section: PRIOR_SECTION,
  }).map((question, index) => ({
    ...question,
    metadata: {
      ...(question.metadata || {}),
      ...(index === 0 ? {
        sectionIntro: "The questions in this section ask about any previous training, activities or support you may have received through Sightsavers programmes.",
      } : {}),
    },
  })),
  {
    questionNumber: 31,
    questionCode: "MOTIVATION",
    questionText: "Why have you applied for this training programme, and how do you expect it to help you achieve your future employment goals? Please tell us about your motivation, what you hope to learn, and how you plan to use these skills after completing the training. (Maximum 200 words)",
    section: MOTIVATION_SECTION,
    responseType: "LONG_TEXT",
    required: true,
    metadata: {
      maxWords: 200,
      sectionIntro: "The questions in this section ask about your interest in the programme, your goals, your current skills and your readiness to participate in the training.",
    },
  },
  {
    questionNumber: 32,
    questionCode: "TRAINING_START_READINESS",
    questionText: "How soon are you ready and available to start the training programme if selected?",
    section: MOTIVATION_SECTION,
    responseType: "SINGLE_SELECT",
    required: true,
    options: ["Immediately", "Within 1 month", "In 1–3 months", "More than 3 months from now"],
    helpText: "Purpose: informs pipeline timing and cohort scheduling for successful applicants.",
  },
  {
    questionNumber: 33,
    questionCode: "HEARD_ABOUT_PROJECT",
    questionText: "How did you hear about the project?",
    section: MOTIVATION_SECTION,
    responseType: "SINGLE_SELECT",
    required: true,
    options: [
      "Television",
      "Radio",
      "Social Media",
      "Friends / Relatives",
      "Organisation of Persons with Disabilities (OPD)",
      "Flyer/Poster/Banner",
      "Other",
    ],
  },
  {
    questionNumber: 34,
    questionCode: "HEARD_ABOUT_PROJECT_OTHER",
    questionText: "If Other, please specify",
    section: MOTIVATION_SECTION,
    responseType: "TEXT",
    required: true,
    showIf: { questionCode: "HEARD_ABOUT_PROJECT", operator: "equals", value: "Other" },
  },
  {
    questionNumber: 35,
    questionCode: "DIGITAL_SKILLS_LEVEL",
    questionText: "How you describe your current digital skills? These are skills in using basic computer applications such as Google Chrome, Microsoft Edge, Microsoft Word, Excel, PowerPoint or google docs.",
    section: MOTIVATION_SECTION,
    responseType: "SINGLE_SELECT",
    required: true,
    options: [
      "Beginner (I need a lot of help using these applications)",
      "Basic (I can do simple things using these applications)",
      "Intermediate (I can do most basic tasks alone)",
      "Advanced (I can work without help)",
    ],
  },
];

const virtualQuestions = [
  ...physicalQuestions.map((question) => {
    if (question.questionCode === "COURSE_APPLIED_FOR") {
      return { ...question, options: ["Virtual Academy"] };
    }
    return { ...question };
  }),
  {
    questionNumber: 38,
    questionCode: "DEVICE_ACCESS",
    questionText: "Which device do you have access to",
    section: VIRTUAL_ACCESS_SECTION,
    responseType: "SINGLE_SELECT",
    required: true,
    options: ["Tablet", "Smartphone", "Laptop", "Desktop Computer", "None of the above"],
    helpText: "(Studies in this course will be conducted across all days of the week)",
    metadata: {
      sectionIntro: "The next questions ask about your access to a device, internet, and electricity to help us understand whether you have the resources needed to participate in training and identify any support that may be required to enable your participation.",
    },
  },
  {
    questionNumber: 39,
    questionCode: "DEVICE_ACCESS_HOURS",
    questionText: "On average, how many hours per day do you have access to your primary device in a day?",
    section: VIRTUAL_ACCESS_SECTION,
    responseType: "SINGLE_SELECT",
    required: true,
    options: ["Less than 1 hour", "1-3 hours", "4-6 hours", "7 hours or more"],
  },
  {
    questionNumber: 40,
    questionCode: "INTERNET_ACCESS",
    questionText: "Do you have internet connection/access?",
    section: VIRTUAL_ACCESS_SECTION,
    responseType: "SINGLE_SELECT",
    required: true,
    options: ["Yes", "No", "Maybe"],
  },
  {
    questionNumber: 41,
    questionCode: "INTERNET_RELIABILITY",
    questionText: "How reliable is your internet for ~10–15 hours of study per week?",
    section: VIRTUAL_ACCESS_SECTION,
    responseType: "SINGLE_SELECT",
    required: true,
    options: ["Reliable", "On and Off", "Rare/None"],
    showIf: { questionCode: "INTERNET_ACCESS", operator: "equals", value: "Yes" },
  },
  {
    questionNumber: 42,
    questionCode: "POWER_SUPPLY_RELIABILITY",
    questionText: "Is your power supply consistent enough to support a fixed daily virtual training schedule?",
    section: VIRTUAL_ACCESS_SECTION,
    responseType: "SINGLE_SELECT",
    required: true,
    options: ["Yes, reliably", "Sometimes – it varies by day", "Rarely – it is unpredictable", "No"],
  },
  {
    questionNumber: 43,
    questionCode: "WEEKDAY_POWER_HOURS",
    questionText: "How many hours of total power (grid + generator + solar combined) do you typically have access to on a weekday",
    section: VIRTUAL_ACCESS_SECTION,
    responseType: "SINGLE_SELECT",
    required: true,
    options: ["Less than 2 hours", "2-6 hours", "6-12 hours", "12-18 hours", "18-24 hours"],
  },
  {
    questionNumber: 44,
    questionCode: "ALTERNATIVE_POWER_LOCATION",
    questionText: "Is there a location outside your home where you can reliably access power for training? (e.g. business centre, library, co-working space)",
    section: VIRTUAL_ACCESS_SECTION,
    responseType: "SINGLE_SELECT",
    required: true,
    options: ["Yes – within walking distance", "Yes – but it requires transport", "No"],
  },
];

const ENTREPRENEUR_ELIGIBILITY_SECTION = "Section 1: Eligibility Criteria";
const ENTREPRENEUR_PERSONAL_SECTION = "Section 2: Personal & contact details";
const ENTREPRENEUR_PRIOR_SECTION = "Section 3: Prior Engagement with Sightsavers";
const ENTREPRENEUR_MOTIVATION_SECTION = "Section 4: Motivation & Training Readiness";

const digitalEntrepreneurshipQuestions = [
  ...setupQuestions("DIGITAL_ENTREPRENEURSHIP"),
  {
    questionNumber: 1,
    questionCode: "TRAINING_AVAILABILITY",
    questionText: "Are you available to commit on average 5 hours per week for a minimum period of 3 months to study'",
    section: ENTREPRENEUR_ELIGIBILITY_SECTION,
    responseType: "BOOLEAN",
    required: true,
    isEligibilityQuestion: true,
    options: ["Yes", "No"],
    helpText: "Mandatory. If ‘No’ – applicant does not meet this eligibility requirement; do not continue with the application.",
    metadata: {
      blockingAnswer: "No",
    },
  },
  ...educationQuestions({
    educationNumber: 2,
    otherNumber: 3,
    courseNumber: 4,
    section: ENTREPRENEUR_ELIGIBILITY_SECTION,
  }),
  ...disabilityQuestions({
    disabilityNumber: 5,
    typeNumber: 6,
    otherTypeNumber: 7,
    accessibilityNumber: 8,
    accessibilityOtherNumber: 9,
    section: ENTREPRENEUR_ELIGIBILITY_SECTION,
  }),
  ...locationQuestions({
    countryNumber: 10,
    levelOneNumber: 11,
    levelTwoNumber: 12,
    townNumber: 13,
    section: ENTREPRENEUR_PERSONAL_SECTION,
    countryHelp: "Ask all. Drives the country-specific formats used at Q19, Q22 and Q23.",
  }).map((question, index) => ({
    ...question,
    metadata: {
      ...(question.metadata || {}),
      ...(index === 0 ? {
        sectionNotice: "You will be required to submit supporting documents during the verification process. The specific documents required will depend on the selected pathway, country requirements, and eligibility checks.",
      } : {}),
    },
  })),
  ...identityQuestions({
    firstNameNumber: 14,
    middleNameNumber: 15,
    lastNameNumber: 16,
    sexNumber: 17,
    dobNumber: 18,
    nationalIdNumber: 19,
    idTypeNumber: 20,
    cardNumber: 21,
    phoneNumber: 22,
    alternativePhoneNumber: 23,
    emailNumber: 24,
    contactMethodNumber: 25,
    contactOtherNumber: 26,
    section: ENTREPRENEUR_PERSONAL_SECTION,
    ageMax: 45,
  }),
  ...priorEngagementQuestions({
    participatedNumber: 27,
    trainingNumber: 28,
    otherNumber: 29,
    section: ENTREPRENEUR_PRIOR_SECTION,
    entrepreneurship: true,
  }),
  {
    questionNumber: 30,
    questionCode: "DIGITAL_ENTERPRISE_CHARACTERISTICS",
    questionText: "Which of these describe your digital enterprise? (choose all that apply)",
    section: ENTREPRENEUR_MOTIVATION_SECTION,
    responseType: "MULTI_SELECT",
    required: true,
    options: [
      "Uses digital platforms for customer engagement and service delivery.",
      "Employs digital tools for business operations, service delivery, or management.",
      "Offers digitally enabled products or services.",
      "Utilizes digital payment systems and financial technologies",
      "Only uses digital tools for personal use not directly for the business.",
    ],
  },
  {
    questionNumber: 31,
    questionCode: "DIGITAL_ENTERPRISE_TYPE",
    questionText: "What kind of digital enterprise are you about to start or grow",
    section: ENTREPRENEUR_MOTIVATION_SECTION,
    responseType: "SINGLE_SELECT",
    required: true,
    options: [
      "Digital-native business: The business provides a digital product or service that is created and delivered mainly through technology, such as software, an app, an online platform, digital content or an IT service.",
      "Traditional business using digital tools: The business provides physical products or in-person services and uses, or plans to use, digital tools for activities such as marketing, sales, payments, customer service or recordkeeping",
    ],
  },
  {
    questionNumber: 32,
    questionCode: "DIGITAL_NATIVE_CATEGORY",
    questionText: "If digital-Native Businesses, which best describe your enterprise",
    section: ENTREPRENEUR_MOTIVATION_SECTION,
    responseType: "SINGLE_SELECT",
    required: true,
    options: [
      "Software development and IT services",
      "Digital content creation and management",
      "E-commerce platforms and digital marketplaces",
      "Digital marketing and social media services",
      "Mobile applications and solutions",
      "Web development and hosting services",
      "Digital educational content and e-learning",
      "Digital financial services",
    ],
    showIf: {
      questionCode: "DIGITAL_ENTERPRISE_TYPE",
      operator: "equals",
      value: "Digital-native business: The business provides a digital product or service that is created and delivered mainly through technology, such as software, an app, an online platform, digital content or an IT service.",
    },
  },
  {
    questionNumber: 33,
    questionCode: "DIGITAL_TRANSFORMED_CATEGORY",
    questionText: "If digital-Transformed Traditional Businesses, which best described your enterprise",
    section: ENTREPRENEUR_MOTIVATION_SECTION,
    responseType: "SINGLE_SELECT",
    required: true,
    options: [
      "Retail businesses with e-commerce integration",
      "Traditional services with digital delivery channels",
      "Manufacturing with digital inventory and order management",
      "Agriculture with digital market access and management systems",
      "Professional services with digital client management",
      "Traditional education with digital delivery components",
      "Product or service delivery with digital tools (e.g. photographer/graphic designer.",
    ],
    showIf: {
      questionCode: "DIGITAL_ENTERPRISE_TYPE",
      operator: "equals",
      value: "Traditional business using digital tools: The business provides physical products or in-person services and uses, or plans to use, digital tools for activities such as marketing, sales, payments, customer service or recordkeeping",
    },
  },
  {
    questionNumber: 34,
    questionCode: "BUSINESS_STAGE",
    questionText: "What is the current stage of your business?",
    section: ENTREPRENEUR_MOTIVATION_SECTION,
    responseType: "SINGLE_SELECT",
    required: true,
    options: [
      "Idea stage: I have identified a business idea, but I have not yet developed or tested the product or service.",
      "Testing stage: I am developing or testing the product or service. I may have spoken to potential customers, created a sample or prototype, or tested the idea on a small scale, but I have not yet launched the business.",
      "Early-stage business: I have launched the business and started offering the product or service to customers. I have made some sales, but the sales may still be small or irregular.",
      "Growing business: My business has regular customers and sales. I am working to increase sales, reach more customers, improve operations or grow the team.",
      "Expanding business: My business is established and is entering new markets or locations, introducing additional products or services, or seeking significant investment to expand.",
    ],
  },
  {
    questionNumber: 35,
    questionCode: "BUSINESS_DESCRIPTION",
    questionText: "Briefly describe your business idea or existing business. What product or service do you offer or plan to offer? What problem does it solve, and how do you use or plan to use digital technology?",
    section: ENTREPRENEUR_MOTIVATION_SECTION,
    responseType: "LONG_TEXT",
    required: true,
    helpText: "Maximum 100 words.",
    metadata: { maxWords: 100 },
  },
  {
    questionNumber: 36,
    questionCode: "MOTIVATION",
    questionText: "Why do you want to join this training? Describe what you hope to learn and how the training will help you develop your business idea or grow your business.",
    section: ENTREPRENEUR_MOTIVATION_SECTION,
    responseType: "LONG_TEXT",
    required: true,
    helpText: "Maximum 150 words.",
    metadata: { maxWords: 150 },
  },
];

const QUESTION_SETS = {
  PHYSICAL_ACADEMY: physicalQuestions,
  VIRTUAL_ACADEMY: virtualQuestions,
  DIGITAL_ENTREPRENEURSHIP: digitalEntrepreneurshipQuestions,
};

function normalizePathway(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function getApplicationQuestionsForPathway(pathway) {
  const normalized = normalizePathway(pathway);
  return QUESTION_SETS[normalized] || physicalQuestions;
}

function getApplicationFormVersion(pathway) {
  const normalized = normalizePathway(pathway);
  return FORM_VERSIONS[normalized] || FORM_VERSIONS.PHYSICAL_ACADEMY;
}

// Preserve the legacy array export while exposing pathway-aware helpers.
const exportedQuestions = physicalQuestions;
exportedQuestions.getApplicationQuestionsForPathway = getApplicationQuestionsForPathway;
exportedQuestions.getApplicationFormVersion = getApplicationFormVersion;
exportedQuestions.FORM_VERSIONS = FORM_VERSIONS;
exportedQuestions.QUESTION_SETS = QUESTION_SETS;

module.exports = exportedQuestions;
