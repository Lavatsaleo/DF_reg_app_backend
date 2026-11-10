/*
  Clears applicant and participant data so the team can test end to end with a clean database.

  Removed: applicants and everything linked to them (answers, documents, status history,
  skills-test invitations/attempts/answers, participant-registration invitations,
  committee assignments/reviews/history, DHIS2 sync logs), saved drafts and consent
  support requests
  and status-check / resume verification codes.

  Kept: staff users, committee members, the skills-test question bank, ID counters
  and all settings.

  Usage (from the backend folder):
    node src/scripts/resetParticipantData.js                      dry run, shows counts only
    node src/scripts/resetParticipantData.js --confirm <db name>  deletes
  Options:
    --delete-files     also delete uploaded applicant documents from S3 storage
    --reset-counters   restart participant numbers at 000001 (only if nothing was sent to DHIS2)
*/
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const args = process.argv.slice(2);
const confirmIndex = args.indexOf("--confirm");
const confirmValue = confirmIndex >= 0 ? args[confirmIndex + 1] : null;
const deleteFiles = args.includes("--delete-files");
const resetCounters = args.includes("--reset-counters");

function databaseName() {
  try {
    const url = new URL(process.env.DATABASE_URL);
    return { name: url.pathname.replace(/^\//, ""), host: url.hostname };
  } catch {
    return { name: "", host: "" };
  }
}

async function counts(prisma) {
  const [
    applicants, responses, documents, statusHistory, testInvitations, testAttempts,
    registrationInvitations, committeeAssignments, committeeReviews, assignmentHistory,
    dhis2Logs, drafts, consentSupportRequests, verificationCodes, sentToDhis2,
  ] = await Promise.all([
    prisma.applicant.count(),
    prisma.registrationResponse.count(),
    prisma.applicantDocument.count(),
    prisma.applicantStatusHistory.count(),
    prisma.basicSkillsTestInvitation.count(),
    prisma.basicSkillsTestAttempt.count(),
    prisma.participantRegistrationInvitation.count(),
    prisma.committeeAssignment.count(),
    prisma.committeeReview.count(),
    prisma.committeeAssignmentHistory.count(),
    prisma.dhis2SyncLog.count(),
    prisma.registrationDraft.count(),
    prisma.consentSupportRequest.count(),
    prisma.verificationCode.count(),
    prisma.applicant.count({ where: { dhis2TrackedEntityId: { not: null } } }),
  ]);
  return {
    applicants, responses, documents, statusHistory, testInvitations, testAttempts,
    registrationInvitations, committeeAssignments, committeeReviews, assignmentHistory,
    dhis2Logs, drafts, consentSupportRequests, verificationCodes, sentToDhis2,
  };
}

async function removeStoredFiles(prisma) {
  const { DeleteObjectsCommand } = require("@aws-sdk/client-s3");
  const s3Client = require("../config/s3");
  const client = s3Client.s3Client || s3Client;
  const documents = await prisma.applicantDocument.findMany({ select: { storageBucket: true, storageKey: true } });
  const byBucket = new Map();
  for (const doc of documents) {
    if (!doc.storageBucket || !doc.storageKey) continue;
    if (!byBucket.has(doc.storageBucket)) byBucket.set(doc.storageBucket, []);
    byBucket.get(doc.storageBucket).push({ Key: doc.storageKey });
  }
  let removed = 0;
  for (const [bucket, keys] of byBucket) {
    for (let i = 0; i < keys.length; i += 1000) {
      const result = await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.slice(i, i + 1000), Quiet: true } }));
      removed += keys.slice(i, i + 1000).length - (result.Errors?.length || 0);
      for (const error of result.Errors || []) console.warn(`  Could not delete ${error.Key}: ${error.Message}`);
    }
  }
  return removed;
}

(async () => {
  const prisma = new PrismaClient();
  const db = databaseName();
  try {
    const before = await counts(prisma);
    console.log(`Database: ${db.name} on ${db.host}`);
    console.table(before);

    if (before.sentToDhis2 > 0) {
      console.warn(`Note: ${before.sentToDhis2} applicant(s) were sent to DHIS2. This script does not remove them from DHIS2.`);
    }

    if (!confirmValue) {
      console.log(`\nDry run: nothing deleted. To delete, run again with:  --confirm ${db.name}`);
      return;
    }
    if (confirmValue !== db.name) {
      console.error(`\nStopped: --confirm must match the database name (${db.name}). Nothing deleted.`);
      process.exitCode = 1;
      return;
    }
    if (resetCounters && before.sentToDhis2 > 0) {
      console.error("\nStopped: --reset-counters would reuse participant numbers already in DHIS2. Nothing deleted.");
      process.exitCode = 1;
      return;
    }

    if (deleteFiles) {
      const removed = await removeStoredFiles(prisma);
      console.log(`Deleted ${removed} stored document file(s).`);
    }

    await prisma.$transaction(async (tx) => {
      // Children cascade from Applicant; deleted explicitly too so the order never depends on the schema.
      await tx.committeeReview.deleteMany();
      await tx.committeeAssignmentHistory.deleteMany();
      await tx.committeeAssignment.deleteMany();
      await tx.basicSkillsTestAnswer.deleteMany();
      await tx.basicSkillsTestAttemptQuestion.deleteMany();
      await tx.basicSkillsTestAttempt.deleteMany();
      await tx.basicSkillsTestInvitation.deleteMany();
      await tx.participantRegistrationInvitation.deleteMany();
      await tx.applicant.deleteMany();
      await tx.registrationDraft.deleteMany();
      await tx.consentSupportRequest.deleteMany();
      await tx.verificationCode.deleteMany();
      if (resetCounters) await tx.sequenceCounter.deleteMany();
    }, { timeout: 120000 });

    console.log("\nDone. Remaining:");
    console.table(await counts(prisma));
  } catch (error) {
    console.error("Failed, nothing was changed by the database step:", error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
