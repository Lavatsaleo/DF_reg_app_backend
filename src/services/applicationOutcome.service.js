/*
 * Telling applicants why an application ended: not eligible at the initial check, or not selected
 * by the committee. The reason is stored on the application and emailed to the applicant, and the
 * delivery result is recorded so staff can see it and resend.
 */
const prisma = require("../config/prisma");
const { sendEmail } = require("./email.service");
const { escapeHtml } = require("../utils/html");
const { COUNTRY_CONTACTS } = require("../data/physicalAcademyConsent");

const PATHWAY_TITLES = {
  PHYSICAL_ACADEMY: "Physical Academy",
  VIRTUAL_ACADEMY: "Virtual Academy",
  DIGITAL_ENTREPRENEURSHIP: "Digital Entrepreneurship",
};

// Reasons a committee can give for "not selected". `label` is for staff; `text` goes to the applicant.
const NOT_SELECTED_REASONS = [
  {
    code: "LIMITED_PLACES",
    label: "Places were limited",
    text: "We received many strong applications for a limited number of places, and other applicants were a closer match for this intake.",
  },
  {
    code: "PATHWAY_FIT",
    label: "Another pathway would suit them better",
    text: "Based on your application, this pathway is not the best match for your current skills, experience or goals. Another Digital Futures pathway may suit you better.",
  },
  {
    code: "MOTIVATION_UNCLEAR",
    label: "Motivation or goals were not clear",
    text: "Your application did not show clearly enough how this training would help you reach your goals.",
  },
  {
    code: "SKILLS_TEST",
    label: "Skills test result",
    text: "Your Basic IT skills test result was below the level needed for this intake.",
  },
  {
    code: "AVAILABILITY",
    label: "Availability for the training",
    text: "Your application suggests you may not be able to attend the full training schedule.",
  },
  {
    code: "INFORMATION_NOT_CONFIRMED",
    label: "Information missing or not confirmed",
    text: "Some of the information in your application was missing or could not be confirmed.",
  },
  {
    code: "OTHER",
    label: "Other (write the reason below)",
    text: "",
  },
];

const MAX_MESSAGE_LENGTH = 1500;

function getNotSelectedReason(code) {
  return NOT_SELECTED_REASONS.find((reason) => reason.code === code) || null;
}

// Checks a committee "not selected" reason; returns { reasonCode, applicantMessage, reasonText } or { error }.
function validateNotSelectedReason(reasonCode, message) {
  const reason = getNotSelectedReason(String(reasonCode || "").trim());
  const applicantMessage = String(message || "").trim().slice(0, MAX_MESSAGE_LENGTH) || null;
  if (!reason) return { error: "Choose the reason the applicant was not selected. It is included in the email they receive." };
  if (reason.code === "OTHER" && (!applicantMessage || applicantMessage.length < 15)) {
    return { error: "Write the reason for the applicant (at least 15 characters). It is sent to them by email." };
  }
  const reasonText = [reason.text, applicantMessage].filter(Boolean).join(" ");
  return { reasonCode: reason.code, applicantMessage, reasonText };
}

function supportContact(country) {
  return COUNTRY_CONTACTS[country]?.questions || null;
}

function buildOutcomeEmail(applicant, { kind, reasons }) {
  const name = applicant.firstName || "Applicant";
  const pathway = PATHWAY_TITLES[applicant.pathway] || "Digital Futures";
  const reference = applicant.applicationReference ? ` (reference ${applicant.applicationReference})` : "";
  const contact = supportContact(applicant.country);
  const reasonList = (Array.isArray(reasons) ? reasons : [reasons]).filter(Boolean);

  const opening = kind === "NOT_ELIGIBLE"
    ? `Thank you for applying to the Digital Futures ${pathway}${reference}. We have checked your application against the requirements for this pathway, and unfortunately it cannot go forward.`
    : `Thank you for applying to the Digital Futures ${pathway}${reference} and for the time you put into your application. The selection committee has reviewed it, and unfortunately we are not able to offer you a place in this intake.`;
  const reasonIntro = reasonList.length > 1 ? "The reasons are:" : "The reason is:";
  const nextSteps = kind === "NOT_ELIGIBLE"
    ? "You are welcome to apply again, for this or another Digital Futures pathway, if you meet its requirements. Each pathway's requirements are on the Digital Futures website."
    : "You are welcome to apply again in a future intake, or for another Digital Futures pathway whose requirements you meet.";
  const contactLine = contact
    ? `If you have questions about this decision, or think some information was recorded wrongly, email ${contact}.`
    : "If you have questions about this decision, reply to the programme team in your country.";

  const subject = kind === "NOT_ELIGIBLE"
    ? "Your Digital Futures application: eligibility result"
    : "Your Digital Futures application: selection result";

  const text = [
    `Dear ${name},`,
    "",
    opening,
    "",
    reasonIntro,
    ...reasonList.map((reason) => `- ${reason}`),
    "",
    nextSteps,
    contactLine,
    "",
    "Thank you for your interest in Digital Futures.",
    "The Digital Futures team",
  ].join("\n");

  const html = [
    `<p>Dear ${escapeHtml(name)},</p>`,
    `<p>${escapeHtml(opening)}</p>`,
    `<p><strong>${escapeHtml(reasonIntro)}</strong></p>`,
    `<ul>${reasonList.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>`,
    `<p>${escapeHtml(nextSteps)}</p>`,
    `<p>${escapeHtml(contactLine)}</p>`,
    "<p>Thank you for your interest in Digital Futures.<br>The Digital Futures team</p>",
  ].join("");

  return { subject, text, html };
}

/*
 * Stores the reason on the application, emails it and records the result. Never throws: the
 * decision is already saved, and a failed email is shown to staff to resend.
 * kind: "NOT_ELIGIBLE" | "NOT_SELECTED"; reasons: string or array of applicant-facing sentences.
 */
async function sendApplicationOutcome(applicant, { kind, reasonCode, reasons }) {
  const reasonText = (Array.isArray(reasons) ? reasons : [reasons]).filter(Boolean).join(" ");
  let status = "SENT";
  let error = null;

  if (!applicant.email) {
    status = "NO_EMAIL";
  } else {
    try {
      const email = buildOutcomeEmail(applicant, { kind, reasons });
      const result = await sendEmail({ to: applicant.email, ...email });
      if (!result?.sent) {
        status = result?.skipped ? "NOT_SENT" : "FAILED";
        error = result?.reason || "The email was not sent.";
      }
    } catch (sendError) {
      status = "FAILED";
      error = sendError.message || "The email could not be sent.";
    }
  }

  try {
    await prisma.applicant.update({
      where: { id: applicant.id },
      data: {
        rejectionReasonCode: reasonCode || kind,
        rejectionReason: reasonText || null,
        rejectionEmailStatus: status,
        rejectionEmailSentAt: status === "SENT" ? new Date() : null,
        rejectionEmailError: error,
      },
    });
  } catch (updateError) {
    console.error("Could not record the application outcome email:", updateError.message);
  }

  if (status !== "SENT") {
    console.warn(`[outcome-email] ${kind} email ${status} applicant=${applicant.id}${error ? `: ${error}` : ""}`);
  }
  return { sent: status === "SENT", status, error };
}

// Resends the stored reason (from the participant profile).
async function resendApplicationOutcome(applicant) {
  const kind = applicant.status === "INELIGIBLE" ? "NOT_ELIGIBLE" : "NOT_SELECTED";
  const reasons = kind === "NOT_ELIGIBLE"
    ? String(applicant.rejectionReason || "").split(/(?<=\.)\s+(?=[A-Z])/).filter(Boolean)
    : applicant.rejectionReason;
  return sendApplicationOutcome(applicant, { kind, reasonCode: applicant.rejectionReasonCode, reasons });
}

module.exports = {
  NOT_SELECTED_REASONS,
  getNotSelectedReason,
  validateNotSelectedReason,
  buildOutcomeEmail,
  sendApplicationOutcome,
  resendApplicationOutcome,
};
