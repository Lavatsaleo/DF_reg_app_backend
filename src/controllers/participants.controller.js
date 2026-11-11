/*
 * Participant directory and profiles for programme staff.
 *
 * Super admins see every country; country admins see only their own. Committee members and
 * chairpersons do not use these endpoints: they review applications blind, without names.
 *
 * Country admins see people by participant code only (no names, contacts, identity numbers,
 * signatures or documents) until the committee has selected them; see utils/identityProtection.
 * Every profile view and document download is logged, because profiles carry personal data.
 */
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const prisma = require("../config/prisma");
const s3Client = require("../config/s3");
const {
  getApplicantCountryFilter,
  getRequestedCountry,
  isSuperAdmin,
  canAccessCountry,
} = require("../utils/countryAccess");
const {
  IDENTITY_REVEALED_STATUSES,
  canSeeIdentity,
  isIdentifyingQuestionCode,
  redactNarrative,
} = require("../utils/identityProtection");

const IDENTITY_HIDDEN_MESSAGE =
  "Name, contact details, identity numbers and documents stay hidden until the selection committee selects this person.";

/* ----------------------------------------------------------------------------
 * Stages: one plain-language step of the participant journey per status
 * ------------------------------------------------------------------------- */

const STAGES = [
  { key: "review", label: "Awaiting review", statuses: ["SUBMITTED", "PENDING_REVIEW", "SKILLS_TEST_COMPLETED_PENDING_REVIEW", "ELIGIBLE_PENDING_DHIS2_SYNC", "SYNCED_TO_DHIS2_PENDING_REVIEW", "UNDER_REVIEW", "SYNC_FAILED"] },
  { key: "skills-test", label: "Skills test", statuses: ["ELIGIBLE_PENDING_SKILLS_TEST"] },
  { key: "selected", label: "Selected", statuses: ["APPROVED_FOR_ENROLLMENT", "PARTICIPANT_REGISTRATION_PENDING"] },
  { key: "verification", label: "Verification", statuses: ["PARTICIPANT_REGISTRATION_COMPLETED_PENDING_VERIFICATION"] },
  { key: "enrolled", label: "Enrolled", statuses: ["ENROLLED_IN_DHIS2_PROGRAM"] },
  { key: "not-eligible", label: "Not eligible", statuses: ["INELIGIBLE"] },
  { key: "not-selected", label: "Not selected", statuses: ["REJECTED_BY_REVIEW_COMMITTEE"] },
];

const STAGE_BY_STATUS = Object.fromEntries(STAGES.flatMap((stage) => stage.statuses.map((status) => [status, stage.key])));
const PATHWAYS = ["PHYSICAL_ACADEMY", "VIRTUAL_ACADEMY", "DIGITAL_ENTREPRENEURSHIP"];
const SORTS = {
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  updated: [{ updatedAt: "desc" }, { id: "asc" }],
  name: [{ firstName: "asc" }, { lastName: "asc" }, { id: "asc" }],
  code: [{ participantCode: "asc" }, { id: "asc" }],
};

// Answers kept for audit that mean nothing on screen (the consent version, contact snapshots).
const HIDDEN_ANSWER_CODES = new Set(["CONSENT_VERSION", "CONSENT_CONTACTS_AT_SIGNING", "CONSENT_CONTACT_CONTEXT", "PR_CONSENT_VERSION"]);

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function fullName(applicant) {
  return [applicant.firstName, applicant.lastName].filter(Boolean).join(" ").trim() || "Name not given";
}

function regionOf(applicant) {
  return applicant.county || applicant.state || applicant.region || applicant.district || null;
}

function ageOf(applicant) {
  return applicant.ageAtApplication ?? applicant.approximateAge ?? null;
}

function latestDecision(applicant) {
  const reviews = applicant.committeeReviews || [];
  return reviews[0]?.decision || null;
}

/* ----------------------------------------------------------------------------
 * Directory
 * ------------------------------------------------------------------------- */

const NAME_SEARCH_FIELDS = ["firstName", "lastName", "email", "contactNumber", "applicationReference"];

function buildDirectoryWhere(user, query) {
  const and = [];

  // Country: country admins are always locked to their own; super admins may narrow.
  const requestedCountry = isSuperAdmin(user) ? getRequestedCountry(user, query.country) : null;
  and.push(requestedCountry ? { country: requestedCountry } : getApplicantCountryFilter(user));

  const pathway = String(query.pathway || "").toUpperCase();
  if (PATHWAYS.includes(pathway)) and.push({ pathway });

  if (query.sex === "Female" || query.sex === "Male") and.push({ sex: query.sex });
  if (query.disability === "yes") and.push({ hasDisability: true });
  if (query.disability === "no") and.push({ hasDisability: false });

  // Every word must match a name, contact or reference, so "Jane Wanjiru" finds that person.
  const words = String(query.search || "").trim().split(/\s+/).filter(Boolean).slice(0, 5);
  // Country admins can only find people they may not yet name by their participant code.
  for (const word of words) {
    const term = word.slice(0, 80);
    const byName = NAME_SEARCH_FIELDS.map((field) => ({ [field]: { contains: term } }));
    and.push({
      OR: [
        { participantCode: { contains: term } },
        isSuperAdmin(user)
          ? { OR: byName }
          : { AND: [{ status: { in: IDENTITY_REVEALED_STATUSES } }, { OR: byName }] },
      ],
    });
  }

  return { AND: and };
}

async function listParticipants(req, res) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(6, Number.parseInt(req.query.pageSize, 10) || 24));
    // Sorting by name would hint at hidden names, so country admins sort by participant code instead.
    const sortKey = req.query.sort === "name" && !isSuperAdmin(req.user) ? "code" : req.query.sort;
    const orderBy = SORTS[sortKey] || SORTS.newest;
    const baseWhere = buildDirectoryWhere(req.user, req.query);

    const stage = STAGES.find((item) => item.key === req.query.stage);
    const where = stage ? { AND: [...baseWhere.AND, { status: { in: stage.statuses } }] } : baseWhere;

    const [total, statusCounts, records] = await Promise.all([
      prisma.applicant.count({ where }),
      prisma.applicant.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } }),
      prisma.applicant.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, participantCode: true, applicationReference: true,
          firstName: true, lastName: true, email: true, contactNumber: true,
          country: true, county: true, state: true, region: true, district: true,
          sex: true, ageAtApplication: true, approximateAge: true, hasDisability: true,
          pathway: true, status: true, createdAt: true, updatedAt: true,
          skillsTestAttempts: { orderBy: { attemptNumber: "desc" }, take: 1, select: { percentage: true, passed: true, status: true } },
          committeeReviews: { orderBy: { reviewedAt: "desc" }, take: 1, select: { decision: true } },
        },
      }),
    ]);

    const stageCounts = Object.fromEntries(STAGES.map((item) => [item.key, 0]));
    let allCount = 0;
    for (const row of statusCounts) {
      allCount += row._count._all;
      const key = STAGE_BY_STATUS[row.status];
      if (key) stageCounts[key] += row._count._all;
    }

    return res.json({
      success: true,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      stages: STAGES.map(({ key, label }) => ({ key, label, count: stageCounts[key] })),
      allCount,
      country: isSuperAdmin(req.user) ? null : req.user.country,
      participants: records.map((record) => {
        const identityVisible = canSeeIdentity(req.user, record);
        return {
        id: record.id,
        identityHidden: !identityVisible,
        name: identityVisible ? fullName(record) : null,
        participantCode: record.participantCode,
        applicationReference: identityVisible ? record.applicationReference : null,
        email: identityVisible ? record.email : null,
        contactNumber: identityVisible ? record.contactNumber : null,
        country: record.country,
        region: regionOf(record),
        sex: record.sex,
        age: ageOf(record),
        hasDisability: record.hasDisability,
        pathway: record.pathway,
        status: record.status,
        stage: STAGE_BY_STATUS[record.status] || "review",
        skillsTest: record.skillsTestAttempts[0] || null,
        committeeDecision: latestDecision(record),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        };
      }),
    });
  } catch (error) {
    console.error("List participants failed:", error);
    return res.status(500).json({ success: false, message: "We could not load participants. Please try again." });
  }
}

/* ----------------------------------------------------------------------------
 * Profile
 * ------------------------------------------------------------------------- */

function answerValue(response) {
  if (response.valueJson !== null && response.valueJson !== undefined) return response.valueJson;
  if (response.valueBoolean !== null && response.valueBoolean !== undefined) return response.valueBoolean;
  if (response.valueDate) return response.valueDate;
  if (response.valueNumber !== null && response.valueNumber !== undefined) return response.valueNumber;
  return response.valueText;
}

function isSignature(code, value) {
  return /SIGNATURE_DATA$/.test(code) || (typeof value === "string" && value.startsWith("data:image/"));
}

// Groups answers into the sections the participant saw, in the order they answered them.
function buildFormSections(responses) {
  const ordered = [...responses].sort((a, b) => {
    const an = a.questionNumber ?? Number.MAX_SAFE_INTEGER;
    const bn = b.questionNumber ?? Number.MAX_SAFE_INTEGER;
    if (an !== bn) return an - bn;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  const sections = [];
  const byTitle = new Map();
  for (const response of ordered) {
    if (HIDDEN_ANSWER_CODES.has(response.questionCode)) continue;
    const value = answerValue(response);
    if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) continue;

    const title = response.section || "Other answers";
    if (!byTitle.has(title)) {
      const section = { title, answers: [] };
      byTitle.set(title, section);
      sections.push(section);
    }
    byTitle.get(title).answers.push({
      code: response.questionCode,
      question: response.questionText,
      type: isSignature(response.questionCode, value) ? "SIGNATURE" : response.responseType,
      value,
    });
  }
  return sections;
}

function responsesFor(responses, contexts) {
  return responses.filter((response) => contexts.includes(response.formContext || "APPLICATION"));
}

// The steps of the journey, with where this participant has got to.
function buildJourney(applicant) {
  const status = applicant.status;
  const history = applicant.statusHistory || [];
  const firstDate = (...statuses) => history.find((item) => statuses.includes(item.status))?.createdAt || null;
  const needsTest = applicant.pathway !== "DIGITAL_ENTREPRENEURSHIP";
  const attempt = applicant.skillsTestAttempts?.[0];
  const review = applicant.committeeReviews?.[0];
  const registrationSubmitted = applicant.participantRegistrationInvitations?.find((item) => item.submittedAt);

  const stageIndex = {
    INELIGIBLE: 1,
    ELIGIBLE_PENDING_SKILLS_TEST: 2,
    REJECTED_BY_REVIEW_COMMITTEE: 3,
    APPROVED_FOR_ENROLLMENT: 4,
    PARTICIPANT_REGISTRATION_PENDING: 4,
    PARTICIPANT_REGISTRATION_COMPLETED_PENDING_VERIFICATION: 5,
    ENROLLED_IN_DHIS2_PROGRAM: 6,
  }[status] ?? 3;

  const steps = [
    { key: "applied", label: "Applied", date: applicant.createdAt },
    { key: "eligibility", label: "Eligibility check", date: applicant.screenedAt || applicant.createdAt },
    { key: "skills-test", label: "Basic IT skills test", date: attempt?.submittedAt || null, skipped: !needsTest },
    { key: "review", label: "Committee review", date: review?.reviewedAt || null },
    { key: "registration", label: "Participant registration", date: registrationSubmitted?.submittedAt || firstDate("PARTICIPANT_REGISTRATION_COMPLETED_PENDING_VERIFICATION") },
    { key: "verification", label: "Verification", date: firstDate("ENROLLED_IN_DHIS2_PROGRAM") },
    { key: "enrolled", label: "Enrolled", date: firstDate("ENROLLED_IN_DHIS2_PROGRAM") },
  ];

  return steps.map((step, index) => {
    let state = index < stageIndex ? "done" : index === stageIndex ? "current" : "upcoming";
    if (step.skipped) state = "skipped";
    if (status === "INELIGIBLE" && index === 1) state = "failed";
    if (status === "REJECTED_BY_REVIEW_COMMITTEE" && index === 3) state = "failed";
    if (status === "ENROLLED_IN_DHIS2_PROGRAM") state = step.skipped ? "skipped" : "done";
    return { key: step.key, label: step.label, state, date: state === "upcoming" ? null : step.date };
  });
}

async function loadAccessibleApplicant(req, include) {
  const applicant = await prisma.applicant.findUnique({ where: { id: String(req.params.participantId || "") }, include });
  if (!applicant) throw new RequestError(404, "Participant not found.");
  if (!canAccessCountry(req.user, applicant.country)) {
    throw new RequestError(403, "You can only view participants from your assigned country.");
  }
  return applicant;
}

async function getParticipantProfile(req, res) {
  try {
    const applicant = await loadAccessibleApplicant(req, {
      responses: true,
      documents: { orderBy: { createdAt: "asc" }, select: { id: true, documentType: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true } },
      statusHistory: { orderBy: { createdAt: "asc" } },
      syncLogs: { orderBy: { createdAt: "desc" }, select: { id: true, action: true, status: true, errorMessage: true, createdAt: true } },
      skillsTestAttempts: {
        orderBy: { attemptNumber: "desc" },
        include: { answers: { orderBy: { questionCode: "asc" }, select: { questionCode: true, questionText: true, category: true, selectedAnswer: true, correctAnswer: true, isCorrect: true } } },
      },
      skillsTestInvitations: { orderBy: { createdAt: "desc" }, select: { id: true, status: true, emailTo: true, sentAt: true, openedAt: true, usedAt: true, expiresAt: true, emailError: true, createdAt: true } },
      participantRegistrationInvitations: { orderBy: { createdAt: "desc" }, select: { id: true, status: true, emailTo: true, formVersion: true, sentAt: true, openedAt: true, submittedAt: true, expiresAt: true, draftSavedAt: true, emailError: true, createdAt: true } },
      committeeAssignments: { include: { committeeMember: { select: { fullName: true, role: true } } } },
      committeeReviews: { orderBy: { reviewedAt: "desc" }, include: { committeeMember: { select: { fullName: true, role: true } } } },
      committeeAssignmentHistory: {
        orderBy: { createdAt: "asc" },
        include: {
          fromCommitteeMember: { select: { fullName: true } },
          toCommitteeMember: { select: { fullName: true } },
          changedByMember: { select: { fullName: true } },
        },
      },
    });

    const identityVisible = canSeeIdentity(req.user, applicant);
    console.info(`[participants] profile viewed applicant=${applicant.id} by=${req.user.id} role=${req.user.role} identity=${identityVisible ? "shown" : "hidden"}`);

    // Before selection, a country admin gets the answers with identifying questions removed and
    // names, emails and numbers scrubbed from free text.
    const hide = (value) => (identityVisible ? value : null);
    const scrub = (value) => (identityVisible || value === null || value === undefined ? value : redactNarrative(value, applicant));
    const visibleResponses = identityVisible
      ? applicant.responses
      : applicant.responses
        .filter((response) => !isIdentifyingQuestionCode(response.questionCode))
        .map((response) => ({
          ...response,
          valueText: scrub(response.valueText),
          valueJson: Array.isArray(response.valueJson) ? response.valueJson.map((item) => scrub(item)) : response.valueJson,
        }));

    const applicationResponses = responsesFor(visibleResponses, ["APPLICATION"]);
    const registrationResponses = responsesFor(visibleResponses, ["PARTICIPANT_REGISTRATION"]);
    const supportResponses = responsesFor(visibleResponses, ["PARTICIPANT_REGISTRATION_SUPPORT_REQUEST"]);
    const registrationInvite = applicant.participantRegistrationInvitations.find((item) => item.submittedAt) || applicant.participantRegistrationInvitations[0];

    const forms = [
      { key: "application", title: "Application form", formVersion: applicant.formVersion, submittedAt: applicant.createdAt, sections: buildFormSections(applicationResponses) },
    ];
    if (registrationResponses.length) {
      forms.push({ key: "registration", title: "Participant registration & baseline", formVersion: registrationInvite?.formVersion || null, submittedAt: registrationInvite?.submittedAt || null, sections: buildFormSections(registrationResponses) });
    }
    if (supportResponses.length) {
      forms.push({ key: "support", title: "Registration support request", formVersion: null, submittedAt: supportResponses[0].createdAt, sections: buildFormSections(supportResponses) });
    }

    const assignment = applicant.committeeAssignments[0] || null;

    return res.json({
      success: true,
      identity: identityVisible ? { hidden: false } : { hidden: true, message: IDENTITY_HIDDEN_MESSAGE, documentCount: applicant.documents.length },
      participant: {
        id: applicant.id,
        identityHidden: !identityVisible,
        name: hide(fullName(applicant)),
        firstName: hide(applicant.firstName),
        lastName: hide(applicant.lastName),
        participantCode: applicant.participantCode,
        applicationReference: hide(applicant.applicationReference),
        email: hide(applicant.email),
        contactNumber: hide(applicant.contactNumber),
        alternativeContactNumber: hide(applicant.alternativeContactNumber),
        preferredContactMethod: applicant.preferredContactMethod,
        country: applicant.country,
        region: regionOf(applicant),
        county: applicant.county,
        subCounty: hide(applicant.subCounty),
        state: applicant.state,
        district: applicant.district,
        town: hide(applicant.town),
        dateOfBirth: hide(applicant.dateOfBirth),
        yearOfBirth: hide(applicant.yearOfBirth),
        age: ageOf(applicant),
        sex: applicant.sex,
        householdSize: applicant.householdSize,
        educationLevel: applicant.educationLevel,
        courseStudied: applicant.courseStudied,
        currentEducationStatus: applicant.currentEducationStatus,
        employmentStatus: applicant.employmentStatus,
        monthlyIncomeRange: applicant.monthlyIncomeRange,
        preferredSector: applicant.preferredSector,
        hasDisability: applicant.hasDisability,
        disabilityType: applicant.disabilityType,
        otherDisabilityType: applicant.otherDisabilityType,
        accessibilityNeeds: scrub(applicant.accessibilityNeeds),
        canParticipateOnline: applicant.canParticipateOnline,
        hasDeviceAccess: applicant.hasDeviceAccess,
        nextOfKinName: hide(applicant.nextOfKinName),
        nextOfKinPhone: hide(applicant.nextOfKinPhone),
        nextOfKinRelationship: hide(applicant.nextOfKinRelationship),
        pathway: applicant.pathway,
        registrationMode: applicant.registrationMode,
        status: applicant.status,
        stage: STAGE_BY_STATUS[applicant.status] || "review",
        createdAt: applicant.createdAt,
        updatedAt: applicant.updatedAt,
        consentedAt: applicant.consentedAt,
      },
      journey: buildJourney(applicant),
      eligibility: {
        isEligible: applicant.isEligible,
        screeningStatus: applicant.screeningStatus,
        screenedAt: applicant.screenedAt,
        reason: scrub(applicant.eligibilityReason),
        reasonCodes: Array.isArray(applicant.eligibilityReasonCodes) ? applicant.eligibilityReasonCodes : [],
        duplicateCheckStatus: applicant.duplicateCheckStatus,
      },
      forms,
      documents: identityVisible ? applicant.documents : [],
      skillsTest: {
        attempts: applicant.skillsTestAttempts.map((attempt) => ({
          id: attempt.id,
          attemptNumber: attempt.attemptNumber,
          status: attempt.status,
          score: attempt.score,
          maxScore: attempt.maxScore,
          percentage: attempt.percentage,
          passed: attempt.passed,
          passingPercentage: attempt.passingPercentage,
          submittedAt: attempt.submittedAt,
          durationSeconds: attempt.durationSeconds,
          answers: attempt.answers,
        })),
        invitations: applicant.skillsTestInvitations.map((invite) => ({ ...invite, emailTo: hide(invite.emailTo) })),
      },
      committee: {
        assignment: assignment && {
          memberName: assignment.committeeMember?.fullName || null,
          memberRole: assignment.committeeMember?.role || null,
          status: assignment.status,
          assignedAt: assignment.assignedAt,
          completedAt: assignment.completedAt,
        },
        reviews: applicant.committeeReviews.map((review) => ({
          id: review.id,
          decision: review.decision,
          comments: scrub(review.comments),
          reviewedAt: review.reviewedAt,
          memberName: review.committeeMember?.fullName || null,
        })),
        history: applicant.committeeAssignmentHistory.map((item) => ({
          id: item.id,
          changeType: item.changeType,
          reason: scrub(item.reason),
          from: item.fromCommitteeMember?.fullName || null,
          to: item.toCommitteeMember?.fullName || null,
          by: item.changedByMember?.fullName || null,
          createdAt: item.createdAt,
        })),
      },
      registration: { invitations: applicant.participantRegistrationInvitations.map((invite) => ({ ...invite, emailTo: hide(invite.emailTo) })) },
      statusHistory: applicant.statusHistory.map((item) => ({ id: item.id, status: item.status, note: scrub(item.note), createdAt: item.createdAt })),
      dhis2: {
        trackedEntityId: hide(applicant.dhis2TrackedEntityId),
        enrollmentId: hide(applicant.dhis2EnrollmentId),
        syncLogs: applicant.syncLogs.map((log) => ({ ...log, errorMessage: scrub(log.errorMessage) })),
      },
    });
  } catch (error) {
    if (error instanceof RequestError) return res.status(error.status).json({ success: false, message: error.message });
    console.error("Get participant profile failed:", error);
    return res.status(500).json({ success: false, message: "We could not load this profile. Please try again." });
  }
}

/* ----------------------------------------------------------------------------
 * Documents
 * ------------------------------------------------------------------------- */

async function downloadParticipantDocument(req, res) {
  try {
    const applicant = await loadAccessibleApplicant(req, {
      documents: { where: { id: String(req.params.documentId || "") } },
    });
    if (!canSeeIdentity(req.user, applicant)) {
      return res.status(403).json({ success: false, message: IDENTITY_HIDDEN_MESSAGE });
    }
    const document = applicant.documents[0];
    if (!document) return res.status(404).json({ success: false, message: "Document not found." });

    const object = await s3Client.send(new GetObjectCommand({ Bucket: document.storageBucket, Key: document.storageKey }));
    console.info(`[participants] document downloaded applicant=${applicant.id} document=${document.id} by=${req.user.id}`);

    const safeName = String(document.originalName || document.fileName).replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "document";
    res.setHeader("Content-Type", document.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    if (object.ContentLength) res.setHeader("Content-Length", String(object.ContentLength));
    object.Body.on("error", (streamError) => {
      console.error("Document stream failed:", streamError);
      res.destroy(streamError);
    });
    return object.Body.pipe(res);
  } catch (error) {
    if (error instanceof RequestError) return res.status(error.status).json({ success: false, message: error.message });
    if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ success: false, message: "The file is missing from storage." });
    }
    console.error("Download participant document failed:", error);
    return res.status(502).json({ success: false, message: "We could not fetch this document from storage. Please try again." });
  }
}

module.exports = {
  STAGES,
  listParticipants,
  getParticipantProfile,
  downloadParticipantDocument,
};
