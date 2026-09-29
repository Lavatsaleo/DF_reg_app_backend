const prisma = require("../config/prisma");
const { sendEmail } = require("./email.service");
const { generateSecureToken, hashToken } = require("../utils/tokenUtils");
const {
  PARTICIPANT_REGISTRATION_FORM_VERSION,
  PARTICIPANT_REGISTRATION_PATHWAYS,
} = require("../data/participantRegistrationForm");

function pathwaySupportsParticipantRegistration(pathway) {
  return PARTICIPANT_REGISTRATION_PATHWAYS.includes(String(pathway || "").trim());
}

function getInviteExpiryDate() {
  const expiryDays = Number(process.env.PARTICIPANT_REGISTRATION_INVITE_EXPIRY_DAYS || 14);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);
  return expiresAt;
}

function buildParticipantRegistrationUrl(rawToken) {
  const baseUrl = (process.env.FRONTEND_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
  return `${baseUrl}/participant-registration/${encodeURIComponent(rawToken)}`;
}

function buildInvitationEmail({ applicant, invitationUrl, expiresAt }) {
  const fullName =
    [applicant.firstName, applicant.lastName].filter(Boolean).join(" ").trim() || "Participant";
  const expiryText = expiresAt.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });

  const subject = "Complete your Digital Futures participant registration";
  const text = [
    `Dear ${fullName},`,
    "",
    "Congratulations. You have been selected to proceed to the participant registration stage for Digital Futures.",
    "",
    `Pathway: ${applicant.pathway === "PHYSICAL_ACADEMY" ? "Physical Academy" : "Virtual Academy"}`,
    `Application reference: ${applicant.applicationReference || "Not available"}`,
    `Participant code: ${applicant.participantCode || "Not available"}`,
    "",
    "Please complete the Participant Registration & Baseline Survey using the secure link below:",
    invitationUrl,
    "",
    `This secure link expires on ${expiryText}. It is linked to your application and should not be shared with anyone else.`,
    "",
    "You will be asked to confirm your consent, answer the registration and baseline questions, and upload the required ID and education documents.",
    "",
    "Regards,",
    "Digital Futures Registration Team",
  ].join("\n");

  const html = `
    <p>Dear ${fullName},</p>
    <p>Congratulations. You have been selected to proceed to the <strong>participant registration stage</strong> for Digital Futures.</p>
    <p>
      <strong>Pathway:</strong> ${applicant.pathway === "PHYSICAL_ACADEMY" ? "Physical Academy" : "Virtual Academy"}<br />
      <strong>Application reference:</strong> ${applicant.applicationReference || "Not available"}<br />
      <strong>Participant code:</strong> ${applicant.participantCode || "Not available"}
    </p>
    <p>Please complete the <strong>Participant Registration &amp; Baseline Survey</strong> using the secure link below.</p>
    <p><a href="${invitationUrl}">Open participant registration form</a></p>
    <p>This secure link expires on <strong>${expiryText}</strong>. It is linked to your application and should not be shared with anyone else.</p>
    <p>You will be asked to confirm your consent, answer the registration and baseline questions, and upload the required ID and education documents.</p>
    <p>Regards,<br />Digital Futures Registration Team</p>
  `;

  return { subject, text, html };
}

async function createParticipantRegistrationInvitation(tx, applicant) {
  if (!pathwaySupportsParticipantRegistration(applicant?.pathway)) {
    return null;
  }

  if (!applicant?.email) {
    const error = new Error("The selected participant does not have an email address.");
    error.code = "PARTICIPANT_EMAIL_REQUIRED";
    throw error;
  }

  await tx.participantRegistrationInvitation.updateMany({
    where: {
      applicantId: applicant.id,
      status: { in: ["PENDING", "SENT", "EMAIL_FAILED", "OPENED"] },
    },
    data: {
      status: "CANCELLED",
    },
  });

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = getInviteExpiryDate();
  const invitationUrl = buildParticipantRegistrationUrl(rawToken);

  const invitation = await tx.participantRegistrationInvitation.create({
    data: {
      applicantId: applicant.id,
      tokenHash,
      emailTo: applicant.email,
      formVersion: PARTICIPANT_REGISTRATION_FORM_VERSION,
      expiresAt,
      status: "PENDING",
    },
  });

  return {
    rawToken,
    invitationUrl,
    invitation,
  };
}

async function sendParticipantRegistrationInvitation(applicant, invitation, invitationUrl) {
  if (!invitation || !invitationUrl) return null;

  const emailContent = buildInvitationEmail({
    applicant,
    invitationUrl,
    expiresAt: invitation.expiresAt,
  });

  try {
    const result = await sendEmail({
      to: applicant.email,
      ...emailContent,
    });

    const status = result.sent ? "SENT" : "EMAIL_FAILED";

    await prisma.participantRegistrationInvitation.update({
      where: { id: invitation.id },
      data: {
        status,
        sentAt: result.sent ? new Date() : null,
        emailError: result.reason || null,
      },
    });

    return {
      sent: result.sent,
      status,
      reason: result.reason || null,
    };
  } catch (error) {
    await prisma.participantRegistrationInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "EMAIL_FAILED",
        emailError: error.message,
      },
    });

    return {
      sent: false,
      status: "EMAIL_FAILED",
      reason: error.message,
    };
  }
}

async function createAndSendParticipantRegistrationInvitation(applicant) {
  const invitationData = await prisma.$transaction(async (tx) =>
    createParticipantRegistrationInvitation(tx, applicant)
  );

  if (!invitationData) {
    return {
      created: false,
      reason: "PATHWAY_NOT_SUPPORTED",
    };
  }

  const emailResult = await sendParticipantRegistrationInvitation(
    applicant,
    invitationData.invitation,
    invitationData.invitationUrl
  );

  return {
    ...invitationData,
    emailResult,
  };
}

module.exports = {
  pathwaySupportsParticipantRegistration,
  buildParticipantRegistrationUrl,
  createParticipantRegistrationInvitation,
  sendParticipantRegistrationInvitation,
  createAndSendParticipantRegistrationInvitation,
};
