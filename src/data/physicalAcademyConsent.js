const CONSENT_VERSIONS = {
  PHYSICAL_ACADEMY: "DF-01-PHYSICAL-ACADEMY-CONSENT-V4-2026-09-29",
  VIRTUAL_ACADEMY: "DF-01-VIRTUAL-ACADEMY-CONSENT-V4-2026-09-29",
  DIGITAL_ENTREPRENEURSHIP: "DF-01-DIGITAL-ENTREPRENEURSHIP-CONSENT-V4-2026-09-29",
};

const COUNTRY_CONTACTS = {
  Kenya: {
    safeguarding: "smbuguamutua@sightsavers.org",
    questions: "tmaritim@sightsavers.org",
  },
  Nigeria: {
    safeguarding: "faliu@sightsavers.org",
    questions: "tikenwobodo@sightsavers.org",
  },
  Ghana: {
    safeguarding: "ratengdem@sightsavers.org",
    questions: "eboateng@sightsavers.org",
  },
  Zambia: {
    safeguarding: "fkalusa@sightsavers.org",
    questions: "KMuhau@sightsavers.org",
  },
};

const COMMON_PURPOSE = [
  "We will collect and use your information to assess your eligibility, support participant selection, and gather feedback to improve the programme. This may include your name, location, age, gender, contact details, and other relevant information.",
  "There is no application fee or payment required to apply for this programme.",
  "Your information will be kept secure and confidential and will only be shared with authorised programme staff and approved project partners who need it for programme implementation, monitoring, and reporting purposes.",
  "Providing the information requested in this form is voluntary. However, some information is required to assess your eligibility and manage your participation in the programme. If you do not consent to the collection and use of your information for these purposes, we will not be able to process your application or enrol you in the programme.",
  "You will receive a copy of this completed form for your records.",
];

const CONSENT_BULLETS = [
  "I have read and understood the information above, or it has been read, explained or interpreted to me in a way that I understand.",
  "I have had the opportunity to ask questions and have received answers that I understand.",
  "I understand that completing this application is voluntary, I may stop at any time before submitting the form.",
  "I agree to the collection and use of my information for assessing my application, managing my participation, monitoring the programme, reporting and the other purposes explained above.",
  "The information I have provided is accurate and complete to the best of my knowledge.",
];

const ASSISTANCE_CONFIRMATION_BULLETS = [
  "I read, explained or interpreted the consent information to the applicant in a language and format they understand.",
  "I gave the applicant an opportunity to ask questions.",
  "I answered their questions accurately or helped them obtain further information.",
  "The applicant indicated that they understood the information and personally chose whether or not to provide consent",
  "I have not made the decision for the applicant or pressured them to consent.",
];

const RELATIONSHIP_OPTIONS = [
  "Family member",
  "Friend",
  "Support person or personal assistant",
  "Sign-language interpreter",
  "Language interpreter",
  "Programme or partner staff member",
  "Other, please specify",
];

const ASSISTANCE_TYPE_OPTIONS = [
  "Read the information aloud",
  "Explained the information",
  "Translated or interpreted the information",
  "Sign-language interpretation",
  "Assisted the applicant to enter their responses",
  "Other, please specify",
];

function baseConsent({ version, programmeSentence, firstSentence, supportRequest }) {
  const consentOptions = [
    "Yes, I consent",
    "No, I do NOT consent",
    ...(supportRequest ? ["I would like someone from the programme to explain this information before I decide"] : []),
  ];

  return {
    version,
    title: "Digital Futures Programme - Participant Application Consent",
    introductionTitle: "Introduction",
    introduction: [
      "Dear Applicant,",
      "This form will take approximately 10-15 minutes to complete. " + firstSentence,
      "We value your privacy and are committed to protecting your personal information. This notice explains how your information will be collected, used, and shared. Please read it carefully before you agree to participate.",
      "If you are selected for the programme, we will work with your training institution to monitor your progress. We would also like to understand whether the programme helps you develop skills and secure employment. With your consent, we will contact you approximately six months after your training or internship, and then once each year until October 2030.",
      programmeSentence,
      "You will not be asked to take part in any additional research activities unless we contact you separately and obtain your additional consent.",
      "We will keep your application information until the end of the programme to meet reporting requirements and to consider you for any future training opportunities that may become available.",
    ],
    purposeTitle: "Purpose of Data Collection and Use:",
    purpose: COMMON_PURPOSE,
    informationLinks: [
      {
        before: "For more information, see ",
        label: "Sightsavers' Data Protection Policy",
        url: "https://sightsavershh.sharepoint.com/Policy%20Library/Forms/AllItems.aspx?id=%2FPolicy%20Library%2FData%20Protection%20Policy%2Epdf&parent=%2FPolicy%20Library",
        between: " and the Foundation’s privacy statement at ",
        secondLabel: "https://mastercardfdn.org/privacy/",
        secondUrl: "https://mastercardfdn.org/privacy/",
      },
    ],
    rightsTitle: "Your Rights:",
    rightsIntro:
      "You have the right to access, correct, delete, restrict, object to the use of, or request transfer of your personal data. You have the right to be treated fairly and with respect by everyone involved in this project. If you have any concerns about someone's behaviour, please contact the Country Safeguarding Lead:",
    speakUpPrefix: "or use the Speak Up platform: ",
    speakUpUrl: "https://www.sightsavers.org/how-were-run/accountability-and-transparency/speakup/",
    questionsTitle: "Questions or concerns",
    questionsIntro: "If you have any questions about the application form, kindly contact:",
    countryContacts: COUNTRY_CONTACTS,
    consentTitle: "Your Consent",
    consentIntro: "Please confirm the following before submitting your application:",
    consentLead: "By selecting ‘Yes’, I confirm that:",
    consentBullets: CONSENT_BULLETS,
    consentQuestion: "Do you consent to the collection and use of your information as described above?",
    consentOptions,
    consentGrantedOption: "Yes, I consent",
    consentDeniedOption: "No, I do NOT consent",
    supportRequestOption: supportRequest
      ? "I would like someone from the programme to explain this information before I decide"
      : null,
    supportRequestInstruction: supportRequest
      ? "Please provide your full name, contact number and any reasonable accommodation requirements so programme staff can contact you."
      : null,
    assistanceStepTitle: "Confirmation by the person who provided assistance",
    assistanceQuestion: "Did you complete this consent section yourself?",
    assistanceOptions: [
      "Yes, I completed and understood the consent section myself.",
      "No, someone read, explained or interpreted the consent information for me.",
    ],
    assistanceSelfOption: "Yes, I completed and understood the consent section myself.",
    assistanceRequiredOption: "No, someone read, explained or interpreted the consent information for me.",
    assistanceIntro: "Complete this section only if you read, explained or interpreted the consent information for the applicant.",
    assistanceConfirmationBullets: ASSISTANCE_CONFIRMATION_BULLETS,
    relationshipOptions: RELATIONSHIP_OPTIONS,
    assistanceTypeOptions: ASSISTANCE_TYPE_OPTIONS,
  };
}

const APPLICATION_CONSENTS = {
  PHYSICAL_ACADEMY: baseConsent({
    version: CONSENT_VERSIONS.PHYSICAL_ACADEMY,
    firstSentence: "Your responses will help us select participants for the Digital Futures programme.",
    programmeSentence:
      "The Digital Futures programme collects and analyses participant information to manage, improve, and assess the impact of programme activities. Information collected through this application form and during your participation may also be used for learning and research purposes.",
    supportRequest: true,
  }),
  VIRTUAL_ACADEMY: baseConsent({
    version: CONSENT_VERSIONS.VIRTUAL_ACADEMY,
    firstSentence: "Your responses will help us select participants for the Digital Futures programme.",
    programmeSentence:
      "The Digital Futures programme collects and analyses participant information to manage, improve, and assess the impact of programme activities. Information collected through this application form and during your participation may also be used for learning and research purposes.",
    supportRequest: true,
  }),
  DIGITAL_ENTREPRENEURSHIP: baseConsent({
    version: CONSENT_VERSIONS.DIGITAL_ENTREPRENEURSHIP,
    firstSentence: "Your responses will help us select participants for the Digital Futures Project.",
    programmeSentence:
      "The Digital Futures Programme collects and analyses participant information to manage, improve, and assess the impact of programme activities. Information collected through this application form and during your participation may also be used for learning and research purposes.",
    supportRequest: false,
  }),
};

function normalizePathway(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function getApplicationConsent(pathway) {
  return APPLICATION_CONSENTS[normalizePathway(pathway)] || APPLICATION_CONSENTS.PHYSICAL_ACADEMY;
}

function getConsentByVersion(version) {
  return Object.values(APPLICATION_CONSENTS).find((consent) => consent.version === version) || null;
}

const PHYSICAL_ACADEMY_CONSENT_VERSION = CONSENT_VERSIONS.PHYSICAL_ACADEMY;
const PHYSICAL_ACADEMY_CONSENT = APPLICATION_CONSENTS.PHYSICAL_ACADEMY;

module.exports = {
  PHYSICAL_ACADEMY_CONSENT_VERSION,
  PHYSICAL_ACADEMY_CONSENT,
  CONSENT_VERSIONS,
  APPLICATION_CONSENTS,
  COUNTRY_CONTACTS,
  getApplicationConsent,
  getConsentByVersion,
};
