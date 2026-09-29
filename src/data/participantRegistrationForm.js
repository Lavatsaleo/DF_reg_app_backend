/*
 * Digital Futures Form DF-02: Participant Registration & Baseline Survey
 * Source: DF-Registration Form_V4_reviewed.docx received 29 September 2026.
 * Applicable pathways in this release: Physical Academy and Virtual Academy only.
 */

const PARTICIPANT_REGISTRATION_FORM_VERSION =
  "DF-02-PARTICIPANT-REGISTRATION-BASELINE-V1.0-2026-09-29";

const PARTICIPANT_REGISTRATION_PATHWAYS = [
  "PHYSICAL_ACADEMY",
  "VIRTUAL_ACADEMY",
];

const CONSENT = {
  title: "Digital Futures Programme - Participant Registration & Baseline Survey",
  introductionTitle: "Introduction",
  introduction: [
    "Dear Applicant,",
    "You have been pre-selected to take part in the Digital Futures programme subject to confirmation of your ID and education qualifications. The programme collects and analyses participants' information to improve how the programme is managed and ensure participants are adequately supported.",
    "We value your privacy and are committed to protecting your personal data.",
    "This form explains how your information will be used and shared. Please read it carefully before you begin — you will also receive a copy to keep.",
  ],
  whatThisFormInvolvesTitle: "What this form Involves",
  whatThisFormInvolves: [
    "This form will take about 2 minutes to complete.",
    "Taking part is entirely your choice. There is no payment, registration fee, or gift for participating but your honest answers will help us understand how the programme is working and how to improve it for others like you.",
  ],
  whyWeCollectTitle: "Why We Collect Your Information",
  howWeProtectTitle: "How We Protect Your Information",
  howWeProtect: [
    "Your information is kept private and secure and is shared only with approved Digital Futures partners and data processors.",
    "We do not use your real name in reports. Instead, your responses are linked to a unique code rather than your name.",
    "We keep your information only for as long as necessary after which it is deleted from our systems. Where information is retained for reporting or accountability purposes beyond that point, it is kept only in aggregated, de-identified form.",
  ],
  dataProtectionLinks: [
    {
      label: "Sightsavers' Data Protection Policy",
      url: "https://sightsavershh.sharepoint.com/Policy%20Library/Forms/AllItems.aspx?id=%2FPolicy%20Library%2FData%20Protection%20Policy%2Epdf&parent=%2FPolicy%20Library",
    },
    {
      label: "Mastercard Foundation's privacy statement",
      url: "https://mastercardfdn.org/privacy/",
    },
  ],
  rightsTitle: "Your Rights",
  rights: [
    "access the information we hold about you",
    "correct any information that is inaccurate",
    "request that your information be deleted",
    "restrict or object to how your information is used",
    "request a copy of your information (data portability)",
    "withdraw from the programme and your consent at any time, without giving a reason",
  ],
  rightsClosing:
    "You also have the right to be treated fairly and with respect by everyone involved in this project.",
  safetyTitle: "Your Safety",
  safety: [
    "What you tell us is kept confidential. The only exception is if you share something that suggests you or someone else may be at risk of harm — we have a responsibility to report this, in line with our safeguarding policy.",
    "If you have any concerns about someone's behaviour, please contact the Country Safeguarding Lead: [Name & contact details], or use the Speak Up platform:",
  ],
  speakUpUrl:
    "https://www.sightsavers.org/how-were-run/accountability-and-transparency/speakup/",
  questionsTitle: "Questions or Concerns",
  questions:
    "If you have questions about this questionnaire, how your data is used, or wish to withdraw your consent, please contact: akibet@sightsavers.org",
  consentTitle: "Your Consent",
  consentIntro: "Please confirm the following before submitting your application:",
  consentLead: "By selecting ‘Yes’, I confirm that:",
  consentBullets: [
    "I have read and understood the information above, or it has been read, explained or interpreted to me in a way that I understand.",
    "I have had the opportunity to ask questions and have received answers that I understand.",
    "I understand that completing this form is voluntary, I may stop at any time before submitting the form.",
    "I agree to the collection and use of my information for assessing my application, managing my participation, monitoring the programme, reporting and the other purposes explained above.",
    "The information I have provided is accurate and complete to the best of my knowledge.",
  ],
  consentQuestion:
    "Do you consent to the collection and use of your information as described above?",
  consentOptions: [
    "Yes, I consent",
    "No, I do NOT consent",
    "I would like someone from the programme to explain this information before I decide",
  ],
  consentGrantedOption: "Yes, I consent",
  consentDeniedOption: "No, I do NOT consent",
  supportRequestOption:
    "I would like someone from the programme to explain this information before I decide",
  supportRequestInstruction:
    "Please provide your full name and contact number and any reasonable accommodation requirements so programme staff can contact you.",
  assistanceStepTitle: "Confirmation by the person who provided assistance",
  assistanceQuestion: "Did you complete this consent section yourself?",
  assistanceOptions: [
    "Yes, I completed and understood the consent section myself.",
    "No, someone read, explained or interpreted the consent information for me.",
  ],
  assistanceSelfOption:
    "Yes, I completed and understood the consent section myself.",
  assistanceRequiredOption:
    "No, someone read, explained or interpreted the consent information for me.",
  assistanceIntro:
    "Complete this section only if you read, explained or interpreted the consent information for the applicant.",
  assistanceConfirmationBullets: [
    "I read, explained or interpreted the consent information to the applicant in a language and format they understand.",
    "I gave the applicant an opportunity to ask questions.",
    "I answered their questions accurately or helped them obtain further information.",
    "The applicant indicated that they understood the information and personally chose whether or not to provide consent",
    "I have not made the decision for the applicant or pressured them to consent.",
  ],
  relationshipOptions: [
    "Family member",
    "Friend",
    "Support person or personal assistant",
    "Sign-language interpreter",
    "Language interpreter",
    "Programme or partner staff member",
    "Other, please specify",
  ],
  assistanceTypeOptions: [
    "Read the information aloud",
    "Explained the information",
    "Translated or interpreted the information",
    "Sign-language interpretation",
    "Assisted the applicant to enter their responses",
    "Other, please specify",
  ],
};

const DIFFICULTY_OPTIONS = ["No difficulty", "Some difficulty", "A lot of difficulty"];
const AGREEMENT_OPTIONS = ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"];

const QUESTIONS = [
  {
    questionCode: "M1_1", displayNumber: "M1.1",
    questionText: "Are you a registered member of: Zambia: Zambia Agency for Persons with Disabilities (ZAPD); Kenya: National Council for Persons with Disabilities (NCPWD); Nigeria: National Commission for Persons with Disabilities (NCPWD); Ghana: National Council on Persons with Disability (NCPD)?",
    section: "Module 1: Document & disability registration verification",
    responseType: "SINGLE_SELECT", required: true,
    options: ["Yes", "No", "Not Applicable"],
  },
  {
    questionCode: "M1_2", displayNumber: "M1.2",
    questionText: "Do you have a disability registration card?",
    section: "Module 1: Document & disability registration verification",
    responseType: "SINGLE_SELECT", required: false,
    options: ["Yes", "No", "Not applicable"],
  },
  {
    questionCode: "M1_3", displayNumber: "M1.3",
    questionText: "What is your disability registration card number?",
    section: "Module 1: Document & disability registration verification",
    responseType: "TEXT", required: true,
    showIf: { questionCode: "M1_2", operator: "equals", value: "Yes" },
  },
  {
    questionCode: "M1_4", displayNumber: "M1.4",
    questionText: "Please upload a copy of your disability registration card",
    section: "Module 1: Document & disability registration verification",
    responseType: "FILE", required: true,
    documentField: "disabilityRegistrationCard", documentType: "DISABILITY_DOCUMENT",
    showIf: { questionCode: "M1_2", operator: "equals", value: "Yes" },
  },
  {
    questionCode: "M1_5", displayNumber: "M1.5",
    questionText: "Upload your ID document",
    section: "Module 1: Document & disability registration verification",
    responseType: "FILE", required: true,
    documentField: "idDocument", documentType: "NATIONAL_ID",
  },
  {
    questionCode: "M1_6", displayNumber: "M1.6",
    questionText: "Upload your certificate for your highest level of education",
    section: "Module 1: Document & disability registration verification",
    responseType: "FILE", required: true,
    documentField: "educationCertificate", documentType: "EDUCATION_CERTIFICATE",
  },

  {
    questionCode: "M2_1", displayNumber: "M2.1",
    questionText: "Do you have difficulty seeing, even if wearing glasses or contact lenses?",
    section: "Module 2: Health-related difficulties in performing tasks(Washington Group Questions)",
    responseType: "SINGLE_SELECT", required: true,
    options: [...DIFFICULTY_OPTIONS, "Cannot see at all", "Refuse to answer", "Don't know"],
  },
  {
    questionCode: "M2_2", displayNumber: "M2.2",
    questionText: "Do you have difficulty hearing, even if using a hearing aid?",
    section: "Module 2: Health-related difficulties in performing tasks(Washington Group Questions)",
    responseType: "SINGLE_SELECT", required: true,
    options: [...DIFFICULTY_OPTIONS, "Cannot hear at all", "Refuse to answer", "Don't know"],
  },
  {
    questionCode: "M2_3", displayNumber: "M2.3",
    questionText: "Do you have difficulty walking or climbing steps?",
    section: "Module 2: Health-related difficulties in performing tasks(Washington Group Questions)",
    responseType: "SINGLE_SELECT", required: true,
    options: [...DIFFICULTY_OPTIONS, "Cannot walk or climb at all", "Refuse to answer", "Don't know"],
  },
  {
    questionCode: "M2_4", displayNumber: "M2.4",
    questionText: "Do you have difficulty remembering or concentrating?",
    section: "Module 2: Health-related difficulties in performing tasks(Washington Group Questions)",
    responseType: "SINGLE_SELECT", required: true,
    options: [...DIFFICULTY_OPTIONS, "Cannot remember/concentrate at all", "Refuse to answer", "Don't know"],
  },
  {
    questionCode: "M2_5", displayNumber: "M2.5",
    questionText: "Do you have difficulty with self-care, such as washing all over or dressing?",
    section: "Module 2: Health-related difficulties in performing tasks(Washington Group Questions)",
    responseType: "SINGLE_SELECT", required: true,
    options: [...DIFFICULTY_OPTIONS, "Cannot wash or dress at all l", "Refuse to answer", "Don't know"],
  },
  {
    questionCode: "M2_6", displayNumber: "M2.6",
    questionText: "Do you have difficulty communicating, for example understanding or being understood, when using your usual language?",
    section: "Module 2: Health-related difficulties in performing tasks(Washington Group Questions)",
    responseType: "SINGLE_SELECT", required: true,
    options: [...DIFFICULTY_OPTIONS, "Cannot communicate at all", "Refuse to answer", "Don't know"],
  },
  {
    questionCode: "M2_7", displayNumber: "M2.7",
    questionText: "How often do you feel very anxious, nervous or worried?",
    section: "Module 2: Health-related difficulties in performing tasks(Washington Group Questions)",
    responseType: "SINGLE_SELECT", required: true,
    options: ["Never", "A few times a year", "Monthly", "Weekly", "Daily", "Refuse to answer", "Don't know"],
  },
  {
    questionCode: "M2_8", displayNumber: "M2.8",
    questionText: "How often do you feel very sad or depressed?",
    section: "Module 2: Health-related difficulties in performing tasks(Washington Group Questions)",
    responseType: "SINGLE_SELECT", required: true,
    options: ["Never", "A few times a year", "Monthly", "Weekly", "Daily", "Refuse to answer", "Don't know"],
  },

  {
    questionCode: "M3_1", displayNumber: "M3.1",
    questionText: "Marital status",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "SINGLE_SELECT", required: true,
    options: ["Single", "Married / cohabiting", "Separated / divorced", "Widowed", "Other"],
  },
  {
    questionCode: "M3_2", displayNumber: "M3.2",
    questionText: "If Other, please specify",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "TEXT", required: true,
    showIf: { questionCode: "M3_1", operator: "equals", value: "Other" },
  },
  {
    questionCode: "M3_3", displayNumber: "M3.3",
    questionText: "Household size (how many people usually sleep & eat there, including you)",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "NUMBER", required: true, helpText: "people",
  },
  {
    questionCode: "M3_4", displayNumber: "M3.4",
    questionText: "What is your current employment status?",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "SINGLE_SELECT", required: true,
    options: [
      "Working and receive a wage",
      "Working but receive payment in kind",
      "Self-employed",
      "Unemployed and looking for employment",
      "Unemployed and looking to start a business / be self-employed",
      "Unemployed and not looking for employment",
      "Other",
    ],
  },
  {
    questionCode: "M3_4A", displayNumber: "M3.4a",
    questionText: "If Other, please specify",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "TEXT", required: true,
    showIf: { questionCode: "M3_4", operator: "equals", value: "Other" },
  },
  {
    questionCode: "M3_5", displayNumber: "M3.5",
    questionText: "In the last 4 weeks, have you (select all that apply)?",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "MULTI_SELECT", required: true,
    options: [
      "Applied for a permit, licence or arranged funding for a business",
      "Looked for land, premises, machinery, supplies or farming inputs",
      "Asked friends, relatives or community members for help with employment",
      "Registered with, or contacted, public or private employment services",
      "Applied for jobs with employers",
      "Checked at worksites, farms, factory gates, markets or other places for work",
      "Placed or answered an advert in a newspaper or online",
      "Posted or updated a CV on a professional networking site",
      "None of the above",
    ],
    metadata: { exclusiveOptions: ["None of the above"] },
    showIf: {
      questionCode: "M3_4", operator: "in",
      value: [
        "Unemployed and looking for employment",
        "Unemployed and looking to start a business / be self-employed",
      ],
    },
  },
  {
    questionCode: "M3_SECTOR", displayNumber: null,
    questionText: "Which sector do you work in?",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "SINGLE_SELECT", required: true,
    options: ["Agrifood Systems", "Education", "Digital", "Health", "Manufacturing", "Tourism", "Creatives", "Other"],
    showIf: {
      questionCode: "M3_4", operator: "in",
      value: ["Working and receive a wage", "Working but receive payment in kind", "Self-employed"],
    },
  },
  {
    questionCode: "M3_SECTOR_OTHER", displayNumber: null,
    questionText: "If Other, please specify sector",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "TEXT", required: true,
    showIf: { questionCode: "M3_SECTOR", operator: "equals", value: "Other" },
  },
  {
    questionCode: "M3_6", displayNumber: "M3.6",
    questionText: "What kind of employment contract do you currently have for your main job?",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "SINGLE_SELECT", required: true,
    options: [
      "I do not have one",
      "Oral contract, unlimited duration (permanent)",
      "Oral contract, limited duration (temporary)",
      "Written contract, unlimited duration (permanent)",
      "Written contract, limited duration (temporary)",
      "Do not know",
    ],
    showIf: {
      questionCode: "M3_4", operator: "in",
      value: ["Working and receive a wage", "Working but receive payment in kind"],
    },
  },
  {
    questionCode: "M3_7", displayNumber: "M3.7",
    questionText: "Are you paid monthly, weekly or daily for your main job?",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "SINGLE_SELECT", required: true,
    options: ["Monthly", "Weekly", "Daily"],
    showIf: {
      questionCode: "M3_4", operator: "in",
      value: ["Working and receive a wage", "Working but receive payment in kind", "Self-employed"],
    },
  },
  {
    questionCode: "M3_10", displayNumber: "M3.10",
    questionText: "On average, what was your income from your main job (take-home pay) per period selected in M3.7",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "NUMBER", required: true,
    helpText: "Local currency. Database formula to calculate on aggregated month timeframe.",
    showIf: {
      questionCode: "M3_4", operator: "in",
      value: ["Working and receive a wage", "Working but receive payment in kind", "Self-employed"],
    },
  },
  {
    questionCode: "M3_8", displayNumber: "M3.8",
    questionText: "For your main job, how many hours do you usually work per [period from M3.7]?",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "NUMBER", required: true,
    showIf: {
      questionCode: "M3_4", operator: "in",
      value: ["Working and receive a wage", "Working but receive payment in kind", "Self-employed"],
    },
  },
  {
    questionCode: "M3_9", displayNumber: "M3.9",
    questionText: "Last [period from M3.7], how many hours did you actually work at your main job (excluding meal breaks, travel time, etc.)?",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "NUMBER", required: true,
    showIf: {
      questionCode: "M3_4", operator: "in",
      value: ["Working and receive a wage", "Working but receive payment in kind", "Self-employed"],
    },
  },
  {
    questionCode: "M3_11", displayNumber: "M3.11",
    questionText: "In a typical month, do you receive any money from any other source?",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "SINGLE_SELECT", required: true,
    options: ["Yes", "No"],
  },
  {
    questionCode: "M3_12A", displayNumber: "M3.12a",
    questionText: "Amount received from other income-generating activities",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "NUMBER", required: true, helpText: "Local currency",
    showIf: { questionCode: "M3_11", operator: "equals", value: "Yes" },
  },
  {
    questionCode: "M3_12B", displayNumber: "M3.12b",
    questionText: "Amount received from remittances and gifts (from family or friends)",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "NUMBER", required: true, helpText: "Local currency",
    showIf: { questionCode: "M3_11", operator: "equals", value: "Yes" },
  },
  {
    questionCode: "M3_12C", displayNumber: "M3.12c",
    questionText: "Amount received from government assistance, pensions or community/charity support",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "NUMBER", required: true, helpText: "Local currency",
    showIf: { questionCode: "M3_11", operator: "equals", value: "Yes" },
  },
  {
    questionCode: "M3_13", displayNumber: "M3.13",
    questionText: "When did you start your business (when it was registered, or when you started trading)?",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "DATE", required: true,
    showIf: { questionCode: "M3_4", operator: "equals", value: "Self-employed" },
  },
  {
    questionCode: "M3_14", displayNumber: "M3.14",
    questionText: "How many employees do you currently have?",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "SINGLE_SELECT", required: true,
    options: ["Myself only", "Less than 10", "10–49", "Over 49"],
    showIf: { questionCode: "M3_4", operator: "equals", value: "Self-employed" },
  },
  {
    questionCode: "M3_15", displayNumber: "M3.15",
    questionText: "Imagine ten steps: on the bottom step (1) stand the poorest people, on the top step (10) stand the richest people (show step-ladder picture). Which step are you on today?",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "SINGLE_SELECT", required: true,
    options: ["1","2","3","4","5","6","7","8","9","10"],
  },
  {
    questionCode: "M3_16", displayNumber: "M3.16",
    questionText: "When you think about the income in your household, would you say it is:",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "SINGLE_SELECT", required: true,
    options: [
      "Not enough to cover our needs, we must borrow",
      "Not enough to cover our needs, we use savings",
      "Just enough to cover our needs",
      "Enough to cover our needs, we save a little",
      "Enough to cover our needs, we are building savings",
    ],
  },
  {
    questionCode: "M3_17", displayNumber: "M3.17",
    questionText: "When you think about the food in your household, would you say you have:",
    section: "Module 3: Socio-demographic, household & economic status",
    responseType: "SINGLE_SELECT", required: true,
    options: [
      "Less than adequate food for household needs",
      "Just adequate food for household needs",
      "More than adequate food for household needs",
    ],
  },

  {
    questionCode: "M4_1", displayNumber: "M4.1",
    questionText: "Which statement best describes your career aspirations?",
    section: "Module 4: Aspirations & Access to Dignified and Fulfilling Work",
    responseType: "SINGLE_SELECT", required: true,
    options: [
      "I am looking to get a paid job",
      "I am currently working but want to improve my working conditions and / or pay",
      "I am looking to start a business",
      "I want to grow my current business",
    ],
  },
  ...[
    ["M4_4","M4.4","My family considers my work to be honest and respectable."],
    ["M4_5","M4.5","My work provides enough income to meet my personal needs."],
    ["M4_6","M4.6","I am treated with respect in my workplace."],
    ["M4_7","M4.7","I am treated fairly and equally compared to my co-workers."],
    ["M4_8","M4.8","My work makes me feel proud."],
    ["M4_9","M4.9","The people who are important to me respect the work that I do."],
    ["M4_10","M4.10","My work gives me a sense of purpose."],
  ].map(([questionCode,displayNumber,questionText]) => ({
    questionCode, displayNumber, questionText,
    section: "Module 4: Aspirations & Access to Dignified and Fulfilling Work",
    responseType: "SINGLE_SELECT", required: true, options: AGREEMENT_OPTIONS,
    showIf: {
      questionCode: "M3_4", operator: "in",
      value: ["Working and receive a wage", "Working but receive payment in kind", "Self-employed"],
    },
  })),

  ...[
    ["M5_1","M5.1","In the past 3 months, I have felt less respected and/or that I have a lower standing in the community, because of my disability."],
    ["M5_2","M5.2","In the past 3 months, I have thought less of myself because of my disability."],
    ["M5_3","M5.3","In the past 3 months, I have felt ashamed because of my disability."],
  ].map(([questionCode,displayNumber,questionText]) => ({
    questionCode, displayNumber, questionText,
    section: "Module 5: Stigma and Discrimination",
    responseType: "SINGLE_SELECT", required: true,
    options: [...AGREEMENT_OPTIONS, "Refuse to answer"],
  })),
  ...[
    ["M5_4","M5.4","In the past 3 months, people have talked badly about me because of my disability."],
    ["M5_5","M5.5","In the past 3 months, I have been verbally insulted, harassed and/or threatened because of my disability."],
    ["M5_6","M5.6","In the past 3 months, I have been physically assaulted because of my disability."],
    ["M5_7","M5.7","In the past 3 months, I have felt that people did not want to sit next to me (e.g. on public transport, at church, in a waiting room) because of my disability."],
  ].map(([questionCode,displayNumber,questionText]) => ({
    questionCode, displayNumber, questionText,
    section: "Module 5: Stigma and Discrimination",
    responseType: "SINGLE_SELECT", required: true,
    options: ["Never", "Once", "A few times", "Often", "Refuse to answer"],
  })),
];

const MODULES = [
  {
    title: "Module 1: Document & disability registration verification",
    intro: "Please answer the questions below and upload the required documents. These details help us confirm your identity, disability registration status, and education level. All information you provide will be kept confidential.",
  },
  {
    title: "Module 2: Health-related difficulties in performing tasks(Washington Group Questions)",
    intro: "The next questions ask about difficulties you may have doing certain activities.",
    note: "Don’t include temporary difficulties you may be experiencing due to short-term conditions, e.g. a broken limb; or pregnancy.",
  },
  {
    title: "Module 3: Socio-demographic, household & economic status",
    intro: "This section asks about your household, work, income, and living conditions. Please answer honestly all information will be kept confidential.",
  },
  {
    title: "Module 4: Aspirations & Access to Dignified and Fulfilling Work",
    intro: "This module asks about your career aspirations and, for participants who currently have paid work or run a business, your experience of that work. Please answer honestly, there are no right or wrong answers.",
  },
  {
    title: "Module 5: Stigma and Discrimination",
    intro: "This section asks about your experiences and feelings related to disability over the past three months. Some questions may be sensitive there are no right or wrong answers. Please answer honestly based on your own experiences.",
    note: "Items M5.1–M5.3 use a 5-point agreement scale (1 = Strongly Disagree to 5 = Strongly Agree). Items M5.4–M5.7 ask how often each experience occurred in the past 3 months.",
  },
];

module.exports = {
  PARTICIPANT_REGISTRATION_FORM_VERSION,
  PARTICIPANT_REGISTRATION_PATHWAYS,
  CONSENT,
  MODULES,
  QUESTIONS,
};
