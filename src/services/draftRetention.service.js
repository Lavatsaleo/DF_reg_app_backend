/*
 * Unfinished applications are not kept for ever. A draft that has not been saved for
 * DRAFT_RETENTION_DAYS (default 90) has its answers erased and its mobile number, email and ID
 * freed, so the person can start again. Runs when the API starts and then once a day.
 */
const prisma = require("../config/prisma");

const DAY_MS = 24 * 60 * 60 * 1000;

function retentionDays() {
  const days = Number(process.env.DRAFT_RETENTION_DAYS);
  return Number.isFinite(days) && days >= 7 ? days : 90;
}

async function expireOldDrafts(now = new Date()) {
  const cutoff = new Date(now.getTime() - retentionDays() * DAY_MS);
  const result = await prisma.registrationDraft.updateMany({
    where: { status: "INCOMPLETE", lastSavedAt: { lt: cutoff } },
    data: {
      status: "EXPIRED",
      answers: {},
      normalizedContactNumber: null,
      normalizedEmail: null,
      normalizedNationalId: null,
      editTokenHash: null,
    },
  });
  if (result.count) console.info(`[drafts] Erased ${result.count} unfinished application(s) not saved since ${cutoff.toISOString().slice(0, 10)}.`);
  return result.count;
}

function scheduleDraftRetention() {
  const run = () => expireOldDrafts().catch((error) => console.warn("[drafts] Retention clean-up failed:", error.message));
  run();
  setInterval(run, DAY_MS).unref();
}

module.exports = { expireOldDrafts, scheduleDraftRetention };
