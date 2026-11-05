const prisma = require("../config/prisma");
const {
  PHYSICAL_ACADEMY_CONSENT,
  PHYSICAL_ACADEMY_CONSENT_VERSION,
  getApplicationConsent,
  getConsentByVersion,
} = require("../data/physicalAcademyConsent");
const { COUNTRIES, normalizeCountry } = require("../utils/countryAccess");

const CONSENT_CODES = [
  "CONSENT_VERSION",
  "CONSENT_INFORMATION_READ",
  "REGISTRATION_CONSENT",
  "CONSENT_NAME_ID_CODE",
  "CONSENT_SIGNED_DATE",
  "CONSENT_SIGNATURE_METHOD",
  "CONSENT_SIGNATURE_DATA",
  "CONSENT_CONTACT_CONTEXT",
  "CONSENT_CONTACTS_AT_SIGNING",
  "CONSENT_SUPPORT_REQUEST_NAME",
  "CONSENT_SUPPORT_REQUEST_PHONE",
  "CONSENT_SUPPORT_REQUEST_ACCOMMODATION",
  "CONSENT_COMPLETED_SELF",
  "CONSENT_ASSISTANT_NAME",
  "CONSENT_ASSISTANT_RELATIONSHIP",
  "CONSENT_ASSISTANT_RELATIONSHIP_OTHER",
  "CONSENT_ASSISTANCE_TYPES",
  "CONSENT_ASSISTANCE_TYPE_OTHER",
  "CONSENT_ASSISTANCE_LANGUAGE",
  "CONSENT_ASSISTANT_SIGNATURE_METHOD",
  "CONSENT_ASSISTANT_SIGNATURE_DATA",
  "CONSENT_ASSISTANCE_DATE",
  // Legacy Jurat fields are retained in the archive for applications submitted before V4.
  "JURAT_REQUIRED",
  "JURAT_INTERPRETER_NAME",
  "JURAT_INTERPRETER_ADDRESS",
  "JURAT_LANGUAGE",
  "JURAT_SIGNATURE_METHOD",
  "JURAT_SIGNATURE_DATA",
  "JURAT_INTERPRETER_SIGNATURE",
  "JURAT_DATE",
];

function responseValue(response) {
  if (!response) return null;
  if (response.valueBoolean !== null && response.valueBoolean !== undefined) return response.valueBoolean;
  if (response.valueDate) return response.valueDate;
  if (response.valueNumber !== null && response.valueNumber !== undefined) return response.valueNumber;
  if (response.valueJson !== null && response.valueJson !== undefined) return response.valueJson;
  return response.valueText;
}

function responseMap(responses = []) {
  return responses.reduce((accumulator, response) => {
    accumulator[response.questionCode] = responseValue(response);
    return accumulator;
  }, {});
}

function parseJsonValue(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function buildConsentRecord(applicant) {
  const answers = responseMap(applicant.responses);
  const version = answers.CONSENT_VERSION || PHYSICAL_ACADEMY_CONSENT_VERSION;
  const consentSnapshot = getConsentByVersion(version) || PHYSICAL_ACADEMY_CONSENT;

  return {
    applicantId: applicant.id,
    applicationReference: applicant.applicationReference,
    participantCode: applicant.participantCode,
    applicantName: [applicant.firstName, applicant.lastName].filter(Boolean).join(" "),
    country: applicant.country,
    countryOfResidence: applicant.country,
    contactContextAtSigning: answers.CONSENT_CONTACT_CONTEXT || null,
    contactsDisplayedAtSigning: parseJsonValue(answers.CONSENT_CONTACTS_AT_SIGNING),
    pathway: applicant.pathway,
    submittedAt: applicant.createdAt,
    consentVersion: version,
    consentSnapshot,
    informationRead: answers.CONSENT_INFORMATION_READ === true || String(answers.CONSENT_INFORMATION_READ || "").toLowerCase().startsWith("yes"),
    consentDecision: answers.REGISTRATION_CONSENT || null,
    agreedToParticipate:
      answers.REGISTRATION_CONSENT === true ||
      String(answers.REGISTRATION_CONSENT || "").toLowerCase().startsWith("yes"),
    nameOrIdCode: answers.CONSENT_NAME_ID_CODE || null,
    signedDate: answers.CONSENT_SIGNED_DATE || null,
    signatureMethod: answers.CONSENT_SIGNATURE_METHOD || null,
    signatureData: answers.CONSENT_SIGNATURE_DATA || null,
    supportRequest: {
      name: answers.CONSENT_SUPPORT_REQUEST_NAME || null,
      phone: answers.CONSENT_SUPPORT_REQUEST_PHONE || null,
      accommodation: answers.CONSENT_SUPPORT_REQUEST_ACCOMMODATION || null,
    },
    completedConsentSelf: answers.CONSENT_COMPLETED_SELF || null,
    assistance: {
      assistantName: answers.CONSENT_ASSISTANT_NAME || null,
      relationship: answers.CONSENT_ASSISTANT_RELATIONSHIP || null,
      relationshipOther: answers.CONSENT_ASSISTANT_RELATIONSHIP_OTHER || null,
      assistanceTypes: answers.CONSENT_ASSISTANCE_TYPES || null,
      assistanceTypeOther: answers.CONSENT_ASSISTANCE_TYPE_OTHER || null,
      languageOrCommunicationMethod: answers.CONSENT_ASSISTANCE_LANGUAGE || null,
      signatureMethod: answers.CONSENT_ASSISTANT_SIGNATURE_METHOD || null,
      signatureData: answers.CONSENT_ASSISTANT_SIGNATURE_DATA || null,
      date: answers.CONSENT_ASSISTANCE_DATE || null,
    },
    juratRequired: answers.JURAT_REQUIRED === true || String(answers.JURAT_REQUIRED || "").toLowerCase() === "yes",
    jurat: {
      interpreterName: answers.JURAT_INTERPRETER_NAME || null,
      interpreterAddress: answers.JURAT_INTERPRETER_ADDRESS || null,
      language: answers.JURAT_LANGUAGE || null,
      signatureMethod: answers.JURAT_SIGNATURE_METHOD || null,
      signatureData: answers.JURAT_SIGNATURE_DATA || null,
      date: answers.JURAT_DATE || null,
    },
  };
}

async function getCurrentConsent(req, res) {
  const consent = getApplicationConsent(req.query.pathway);
  return res.json({
    success: true,
    consent,
  });
}

const PATHWAYS = ["PHYSICAL_ACADEMY", "VIRTUAL_ACADEMY", "DIGITAL_ENTREPRENEURSHIP"];
const SUPPORT_STATUSES = ["PENDING", "CONTACTED"];

function cleanText(value) {
  return String(value || "").trim().slice(0, 120);
}

function parseDay(value, endOfDay = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const date = new Date(`${match[0]}T00:00:00.000Z`);
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

// Filters shared by signed consents and explanation requests.
function readConsentFilters(query = {}) {
  const country = normalizeCountry(query.country);
  const pathway = String(query.pathway || "").toUpperCase();
  const requestStatus = String(query.requestStatus || "").toUpperCase();
  const assisted = String(query.assisted || "").toLowerCase();

  return {
    country: COUNTRIES.includes(country) ? country : null,
    pathway: PATHWAYS.includes(pathway) ? pathway : null,
    search: cleanText(query.search),
    from: parseDay(query.from),
    to: parseDay(query.to, true),
    assisted: ["yes", "no"].includes(assisted) ? assisted : null,
    requestStatus: SUPPORT_STATUSES.includes(requestStatus) ? requestStatus : null,
  };
}

function dateRange(filters) {
  if (!filters.from && !filters.to) return undefined;
  return {
    ...(filters.from ? { gte: filters.from } : {}),
    ...(filters.to ? { lt: filters.to } : {}),
  };
}

function buildApplicantWhere(filters) {
  const where = {
    responses: { some: { questionCode: "CONSENT_VERSION" } },
  };
  if (filters.country) where.country = filters.country;
  if (filters.pathway) where.pathway = filters.pathway;
  const createdAt = dateRange(filters);
  if (createdAt) where.createdAt = createdAt;
  if (filters.search) {
    where.OR = [
      { firstName: { contains: filters.search } },
      { lastName: { contains: filters.search } },
      { applicationReference: { contains: filters.search.toUpperCase() } },
      { participantCode: { contains: filters.search.toUpperCase() } },
    ];
  }
  return where;
}

function buildSupportRequestWhere(filters) {
  const where = {};
  if (filters.country) where.country = filters.country;
  if (filters.pathway) where.pathway = filters.pathway;
  if (filters.requestStatus) where.status = filters.requestStatus;
  const createdAt = dateRange(filters);
  if (createdAt) where.createdAt = createdAt;
  if (filters.search) {
    where.OR = [
      { fullName: { contains: filters.search } },
      { contactNumber: { contains: filters.search } },
    ];
  }
  return where;
}

const CONSENT_APPLICANT_SELECT = {
  id: true,
  applicationReference: true,
  participantCode: true,
  firstName: true,
  lastName: true,
  country: true,
  pathway: true,
  createdAt: true,
  responses: {
    where: { questionCode: { in: CONSENT_CODES } },
    select: {
      questionCode: true,
      valueText: true,
      valueNumber: true,
      valueBoolean: true,
      valueDate: true,
      valueJson: true,
    },
  },
};

// The list only needs enough to find a record; wording and signatures load when one is opened.
function summarizeConsentRecord(record) {
  return {
    applicantId: record.applicantId,
    applicationReference: record.applicationReference,
    participantCode: record.participantCode,
    applicantName: record.applicantName,
    nameOrIdCode: record.nameOrIdCode,
    countryOfResidence: record.countryOfResidence,
    pathway: record.pathway,
    submittedAt: record.submittedAt,
    signedDate: record.signedDate,
    consentVersion: record.consentVersion,
    agreedToParticipate: record.agreedToParticipate,
    consentDecision: record.consentDecision,
    assisted: Boolean(record.assistance?.assistantName),
    signatureMethod: record.signatureMethod,
  };
}

async function getConsentRecords(req, res) {
  try {
    const filters = readConsentFilters(req.query);
    const full = String(req.query.view || "").toLowerCase() === "full";

    const [applicants, supportRequests] = await Promise.all([
      prisma.applicant.findMany({
        where: buildApplicantWhere(filters),
        orderBy: { createdAt: "desc" },
        select: CONSENT_APPLICANT_SELECT,
      }),
      prisma.consentSupportRequest.findMany({
        where: buildSupportRequestWhere(filters),
        orderBy: [{ status: "desc" }, { createdAt: "desc" }],
        select: {
          id: true, fullName: true, contactNumber: true, country: true,
          pathway: true, accommodation: true, status: true,
          notificationStatus: true, createdAt: true, contactedAt: true,
        },
      }),
    ]);

    let records = applicants.map(buildConsentRecord);
    if (filters.assisted) {
      const wantAssisted = filters.assisted === "yes";
      records = records.filter((record) => Boolean(record.assistance?.assistantName) === wantAssisted);
    }

    return res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      countries: COUNTRIES,
      filters: {
        country: filters.country,
        pathway: filters.pathway,
        search: filters.search || null,
        from: req.query.from || null,
        to: req.query.to || null,
        assisted: filters.assisted,
        requestStatus: filters.requestStatus,
      },
      count: records.length,
      records: full ? records : records.map(summarizeConsentRecord),
      supportRequests,
      pendingSupportRequests: supportRequests.filter((request) => request.status !== "CONTACTED").length,
    });
  } catch (error) {
    console.error("Get consent records error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load consent records.",
    });
  }
}

async function getConsentRecord(req, res) {
  try {
    const applicant = await prisma.applicant.findFirst({
      where: {
        id: String(req.params.applicantId || ""),
        responses: { some: { questionCode: "CONSENT_VERSION" } },
      },
      select: CONSENT_APPLICANT_SELECT,
    });

    if (!applicant) {
      return res.status(404).json({ success: false, message: "Consent record not found." });
    }

    return res.json({ success: true, record: buildConsentRecord(applicant) });
  } catch (error) {
    console.error("Get consent record error:", error);
    return res.status(500).json({ success: false, message: "Failed to load the consent record." });
  }
}

module.exports = {
  getCurrentConsent,
  getConsentRecords,
  getConsentRecord,
  readConsentFilters,
  summarizeConsentRecord,
};
