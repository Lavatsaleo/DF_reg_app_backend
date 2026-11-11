/*
 * Read-only data API for analysis tools such as R / RStudio, plus the super-admin
 * screens that create and revoke the keys it uses.
 *
 * Every dataset is limited to the key's country (if it has one). Without personal-data
 * access, rows carry no names, contact details, dates of birth or free-text answers:
 * applicants are identified by their internal id and participant code only.
 */
const prisma = require("../config/prisma");
const { COUNTRIES } = require("../data/administrativeLocations");
const { normalizeCountry } = require("../utils/countryAccess");
const {
  ALLOWED_EXPIRY_DAYS,
  DEFAULT_EXPIRY_DAYS,
  getExpiryDays,
  createApiKey,
  toPublicKey,
} = require("../services/apiAccessKey.service");

const API_VERSION = "v1";
const DEFAULT_PAGE_SIZE = 1000;
const MAX_PAGE_SIZE = 5000;

/* ----------------------------------------------------------------------------
 * Fields per dataset
 * ------------------------------------------------------------------------- */

const APPLICANT_FIELDS = [
  "id", "participantCode", "country", "county", "subCounty", "state", "region", "district", "town",
  "yearOfBirth", "approximateAge", "ageAtApplication", "sex", "householdSize",
  "educationLevel", "courseStudied", "currentEducationStatus", "previousSightsaversTraining",
  "hasDisability", "disabilityType", "otherDisabilityType", "canParticipateOnline", "hasDeviceAccess",
  "heardAboutProject", "employmentStatus", "monthlyIncomeRange", "preferredSector",
  "registrationMode", "pathway", "formVersion",
  "isEligible", "screeningStatus", "screeningVersion", "screenedAt", "eligibilityReasonCodes", "duplicateCheckStatus",
  "status", "reviewDecision", "reviewedAt", "consentedAt", "dhis2EnrollmentId",
  "createdAt", "updatedAt",
];

const APPLICANT_PERSONAL_FIELDS = [
  "applicationReference", "firstName", "lastName", "contactNumber", "alternativeContactNumber", "email",
  "dateOfBirth", "nextOfKinName", "nextOfKinPhone", "nextOfKinRelationship", "preferredContactMethod",
  "accessibilityNeeds", "motivation", "jobSearchActions", "dignifiedWorkResponse", "careerAspirations",
  "currentBusinessDetails", "eligibilityReason", "reviewComments", "dhis2TrackedEntityId",
];

const DATASETS = {
  applicants: "One row per application: location, demographics, disability, education, employment, eligibility and status.",
  "status-history": "One row per status change of an application.",
  "skills-tests": "One row per basic skills test attempt.",
  "committee-reviews": "One row per committee review decision. Reviewers are identified by id only.",
};

/* ----------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

class DataApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function pick(record, fields) {
  const row = {};
  for (const field of fields) row[field] = record[field] ?? null;
  return row;
}

// R reads a flat table more easily than nested lists, so code lists become "CODE_A;CODE_B".
function flattenCodes(value) {
  if (Array.isArray(value)) return value.map(String).join(";") || null;
  if (value && typeof value === "object") return JSON.stringify(value);
  return value ?? null;
}

function parsePaging(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requestedSize = Number.parseInt(query.pageSize, 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requestedSize));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function parseSince(value) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new DataApiError(400, "updatedSince must be a date such as 2026-11-01 or 2026-11-01T08:00:00Z.");
  }
  return date;
}

// A country key only ever sees its own country; an all-country key may narrow with ?country=.
function resolveCountry(apiKey, requestedCountry) {
  const requested = normalizeCountry(requestedCountry);
  if (requested && !COUNTRIES.includes(requested)) {
    throw new DataApiError(400, `country must be one of: ${COUNTRIES.join(", ")}.`);
  }
  if (apiKey.country) {
    if (requested && requested !== apiKey.country) {
      throw new DataApiError(403, `This API key only gives access to ${apiKey.country}.`);
    }
    return apiKey.country;
  }
  return requested || null;
}

function logAccess(req, dataset, rows) {
  console.info(
    `[data-api] key=${req.apiKey.id} dataset=${dataset} rows=${rows} personal=${req.apiKey.includePersonalData} country=${req.apiKey.country || "ALL"}`
  );
}

// Runs one paged dataset query and sends the standard envelope.
function datasetHandler(dataset, loadPage) {
  return async (req, res) => {
    try {
      const country = resolveCountry(req.apiKey, req.query.country);
      const since = parseSince(req.query.updatedSince);
      const paging = parsePaging(req.query);
      const personal = req.apiKey.includePersonalData;

      const { total, rows } = await loadPage({ country, since, paging, personal });
      logAccess(req, dataset, rows.length);

      return res.json({
        success: true,
        dataset,
        page: paging.page,
        pageSize: paging.pageSize,
        total,
        hasMore: paging.skip + rows.length < total,
        country: country || "ALL",
        includesPersonalData: personal,
        data: rows,
      });
    } catch (error) {
      if (error instanceof DataApiError) {
        return res.status(error.status).json({ success: false, message: error.message });
      }
      console.error(`Data API (${dataset}) failed:`, error);
      return res.status(500).json({ success: false, message: "We could not load this data. Please try again." });
    }
  };
}

/* ----------------------------------------------------------------------------
 * Data endpoints (API key)
 * ------------------------------------------------------------------------- */

function getDataApiIndex(req, res) {
  const key = req.apiKey;
  return res.json({
    success: true,
    version: API_VERSION,
    key: {
      name: key.name,
      country: key.country || "ALL",
      includesPersonalData: key.includePersonalData,
      expiresAt: key.expiresAt,
    },
    datasets: Object.entries(DATASETS).map(([name, description]) => ({
      name,
      path: `/api/data/${API_VERSION}/${name}`,
      description,
    })),
    parameters: {
      page: "Page number, starting at 1.",
      pageSize: `Rows per page, up to ${MAX_PAGE_SIZE} (default ${DEFAULT_PAGE_SIZE}).`,
      country: `Optional. One of ${COUNTRIES.join(", ")}. Country keys are always limited to their own country.`,
      updatedSince: "Optional date. applicants: changed on or after it. Other datasets: created on or after it.",
    },
  });
}

const getApplicantsData = datasetHandler("applicants", async ({ country, since, paging, personal }) => {
  const where = {
    ...(country ? { country } : {}),
    ...(since ? { updatedAt: { gte: since } } : {}),
  };
  const fields = personal ? [...APPLICANT_FIELDS, ...APPLICANT_PERSONAL_FIELDS] : APPLICANT_FIELDS;
  const select = Object.fromEntries(fields.map((field) => [field, true]));

  const [total, records] = await Promise.all([
    prisma.applicant.count({ where }),
    prisma.applicant.findMany({
      where,
      select,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: paging.skip,
      take: paging.pageSize,
    }),
  ]);

  const rows = records.map((record) => {
    const row = pick(record, fields);
    row.eligibilityReasonCodes = flattenCodes(record.eligibilityReasonCodes);
    return row;
  });
  return { total, rows };
});

function applicantScope(country, since) {
  return {
    ...(country ? { applicant: { country } } : {}),
    ...(since ? { createdAt: { gte: since } } : {}),
  };
}

const getStatusHistoryData = datasetHandler("status-history", async ({ country, since, paging, personal }) => {
  const where = applicantScope(country, since);
  const [total, records] = await Promise.all([
    prisma.applicantStatusHistory.count({ where }),
    prisma.applicantStatusHistory.findMany({
      where,
      include: { applicant: { select: { participantCode: true, country: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: paging.skip,
      take: paging.pageSize,
    }),
  ]);

  const rows = records.map((record) => ({
    id: record.id,
    applicantId: record.applicantId,
    participantCode: record.applicant?.participantCode ?? null,
    country: record.applicant?.country ?? null,
    status: record.status,
    ...(personal ? { note: record.note ?? null } : {}),
    createdAt: record.createdAt,
  }));
  return { total, rows };
});

const getSkillsTestsData = datasetHandler("skills-tests", async ({ country, since, paging }) => {
  const where = applicantScope(country, since);
  const [total, records] = await Promise.all([
    prisma.basicSkillsTestAttempt.count({ where }),
    prisma.basicSkillsTestAttempt.findMany({
      where,
      include: { applicant: { select: { participantCode: true, country: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: paging.skip,
      take: paging.pageSize,
    }),
  ]);

  const rows = records.map((record) => ({
    id: record.id,
    applicantId: record.applicantId,
    participantCode: record.applicant?.participantCode ?? null,
    country: record.applicant?.country ?? null,
    attemptNumber: record.attemptNumber,
    status: record.status,
    score: record.score,
    maxScore: record.maxScore,
    percentage: record.percentage,
    passed: record.passed,
    passingPercentage: record.passingPercentage,
    durationSeconds: record.durationSeconds ?? null,
    testVersion: record.testVersion ?? null,
    submittedAt: record.submittedAt ?? null,
    createdAt: record.createdAt,
  }));
  return { total, rows };
});

const getCommitteeReviewsData = datasetHandler("committee-reviews", async ({ country, since, paging, personal }) => {
  const where = applicantScope(country, since);
  const [total, records] = await Promise.all([
    prisma.committeeReview.count({ where }),
    prisma.committeeReview.findMany({
      where,
      include: { applicant: { select: { participantCode: true, country: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: paging.skip,
      take: paging.pageSize,
    }),
  ]);

  const rows = records.map((record) => ({
    id: record.id,
    applicantId: record.applicantId,
    participantCode: record.applicant?.participantCode ?? null,
    country: record.applicant?.country ?? null,
    committeeMemberId: record.committeeMemberId,
    decision: record.decision,
    ...(personal ? { comments: record.comments ?? null } : {}),
    reviewedAt: record.reviewedAt,
    createdAt: record.createdAt,
  }));
  return { total, rows };
});

/* ----------------------------------------------------------------------------
 * Key management (super admins, signed in)
 * ------------------------------------------------------------------------- */

async function listApiKeys(req, res) {
  try {
    const keys = await prisma.apiAccessKey.findMany({ orderBy: { createdAt: "desc" } });
    return res.json({
      success: true,
      keys: keys.map(toPublicKey),
      expiryOptions: ALLOWED_EXPIRY_DAYS,
      defaultExpiryDays: DEFAULT_EXPIRY_DAYS,
    });
  } catch (error) {
    console.error("List API keys failed:", error);
    return res.status(500).json({ success: false, message: "We could not load the API keys." });
  }
}

async function createApiKeyHandler(req, res) {
  try {
    const name = String(req.body?.name || "").trim();
    if (name.length < 3 || name.length > 120) {
      return res.status(400).json({
        success: false,
        message: "Give the key a name of 3 to 120 characters, such as \"M&E team – RStudio\".",
      });
    }

    const country = normalizeCountry(req.body?.country);
    if (country && !COUNTRIES.includes(country)) {
      return res.status(400).json({ success: false, message: `Country must be one of: ${COUNTRIES.join(", ")}.` });
    }

    const expiresInDays = getExpiryDays(req.body?.expiresInDays ?? DEFAULT_EXPIRY_DAYS);
    if (!expiresInDays) {
      return res.status(400).json({
        success: false,
        message: `Choose how long the key lasts: ${ALLOWED_EXPIRY_DAYS.join(", ")} days.`,
      });
    }

    const includePersonalData = req.body?.includePersonalData === true;
    const { key, rawKey } = await createApiKey({
      name,
      country,
      includePersonalData,
      expiresInDays,
      createdBy: req.user,
    });

    console.info(
      `[data-api] key created id=${key.id} by=${req.user.id} country=${key.country || "ALL"} personal=${includePersonalData}`
    );

    return res.status(201).json({
      success: true,
      message: "API key created. Copy it now: it will not be shown again.",
      apiKey: rawKey,
      key: toPublicKey(key),
    });
  } catch (error) {
    console.error("Create API key failed:", error);
    return res.status(500).json({ success: false, message: "We could not create the API key." });
  }
}

async function revokeApiKey(req, res) {
  try {
    const key = await prisma.apiAccessKey.findUnique({ where: { id: String(req.params.keyId) } });
    if (!key) return res.status(404).json({ success: false, message: "API key not found." });

    const updated = key.revokedAt
      ? key
      : await prisma.apiAccessKey.update({
          where: { id: key.id },
          data: { revokedAt: new Date(), revokedByName: req.user.fullName || null },
        });

    console.info(`[data-api] key revoked id=${key.id} by=${req.user.id}`);
    return res.json({ success: true, message: "API key revoked. It stops working straight away.", key: toPublicKey(updated) });
  } catch (error) {
    console.error("Revoke API key failed:", error);
    return res.status(500).json({ success: false, message: "We could not revoke the API key." });
  }
}

module.exports = {
  getDataApiIndex,
  getApplicantsData,
  getStatusHistoryData,
  getSkillsTestsData,
  getCommitteeReviewsData,
  listApiKeys,
  createApiKey: createApiKeyHandler,
  revokeApiKey,
};
