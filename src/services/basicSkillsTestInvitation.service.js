const prisma = require("../config/prisma");
const { sendEmail } = require("./email.service");
const { generateSecureToken, hashToken } = require("../utils/tokenUtils");

function getInviteExpiryDate() {
  const expiryDays = Number(process.env.BASIC_SKILLS_TEST_INVITE_EXPIRY_DAYS || 14);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);
  return expiresAt;
}

function buildFrontendTestUrl(rawToken) {
  const baseUrl = (process.env.FRONTEND_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
  return `${baseUrl}/basic-skills-test/${encodeURIComponent(rawToken)}`;
}

// Names are typed by applicants, so they must not be able to inject markup or links into the email.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildInviteEmail({ applicant, invitationUrl, expiresAt }) {
  const fullName = `${applicant.firstName || ""} ${applicant.lastName || ""}`.trim() || "Applicant";
  const expiryText = expiresAt.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });

  const subject = "Invitation to complete your Basic IT Skills Test";
  const text = [
    `Dear ${fullName},`,
    "",
    "Thank you for applying to the Digital Futures registration portal.",
    "You have passed the initial eligibility screening and are invited to complete the Basic IT Skills Test.",
    "",
    `Application reference: ${applicant.applicationReference}`,
    `Participant code: ${applicant.participantCode || "Pending"}`,
    "",
    `Open your test using this link: ${invitationUrl}`,
    `This link expires on ${expiryText}. It can only be used for this application and the test can only be submitted once.`,
    "",
    "After you submit the test, the review committee will review your registration details, uploaded documents, and test result together.",
    "",
    "Regards,",
    "Digital Futures Registration Team",
  ].join("\n");

  const html = `
    <p>Dear ${escapeHtml(fullName)},</p>
    <p>Thank you for applying to the Digital Futures registration portal.</p>
    <p>You have passed the initial eligibility screening and are invited to complete the <strong>Basic IT Skills Test</strong>.</p>
    <p><strong>Application reference:</strong> ${escapeHtml(applicant.applicationReference)}<br />
    <strong>Participant code:</strong> ${escapeHtml(applicant.participantCode || "Pending")}</p>
    <p><a href="${escapeHtml(invitationUrl)}">Open your Basic IT Skills Test</a></p>
    <p>This link expires on <strong>${expiryText}</strong>. It can only be used for this application and the test can only be submitted once.</p>
    <p>After you submit the test, the review committee will review your registration details, uploaded documents, and test result together.</p>
    <p>Regards,<br />Digital Futures Registration Team</p>
  `;

  return { subject, text, html };
}

async function createBasicSkillsTestInvitation(tx, applicant) {
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = getInviteExpiryDate();
  const invitationUrl = buildFrontendTestUrl(rawToken);

  // Only the newest link should work, e.g. after staff correct a mistyped email address.
  await tx.basicSkillsTestInvitation.updateMany({
    where: {
      applicantId: applicant.id,
      status: { in: ["PENDING", "SENT", "EMAIL_FAILED", "OPENED"] },
    },
    data: { status: "CANCELLED" },
  });

  const invitation = await tx.basicSkillsTestInvitation.create({
    data: {
      applicantId: applicant.id,
      tokenHash,
      emailTo: applicant.email || null,
      invitationUrl,
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

async function sendBasicSkillsTestInvitation(applicant, invitation) {
  if (!invitation) return null;

  const emailContent = buildInviteEmail({
    applicant,
    invitationUrl: invitation.invitationUrl,
    expiresAt: invitation.expiresAt,
  });

  try {
    const result = await sendEmail({
      to: applicant.email,
      ...emailContent,
    });

    const status = result.sent ? "SENT" : "EMAIL_FAILED";

    await prisma.basicSkillsTestInvitation.update({
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
    await prisma.basicSkillsTestInvitation.update({
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

async function createAndSendBasicSkillsTestInvitation(applicant) {
  const invitationData = await prisma.$transaction(async (tx) =>
    createBasicSkillsTestInvitation(tx, applicant)
  );

  const emailResult = await sendBasicSkillsTestInvitation(
    applicant,
    invitationData.invitation
  );

  return {
    ...invitationData,
    emailResult,
  };
}

module.exports = {
  buildFrontendTestUrl,
  buildInviteEmail,
  createBasicSkillsTestInvitation,
  createAndSendBasicSkillsTestInvitation,
  sendBasicSkillsTestInvitation,
};
