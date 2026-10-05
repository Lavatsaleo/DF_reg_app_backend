const crypto = require("crypto");
const prisma = require("../config/prisma");
const { sendEmail } = require("../services/email.service");
const { APPLICATION_CONSENTS, COUNTRY_CONTACTS, getApplicationConsent } = require("../data/physicalAcademyConsent");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean = (value) => typeof value === "string" ? value.trim() : "";

async function createSupportRequest(req, res) {
  const body = req.body || {};
  const id = clean(body.requestId);
  const country = clean(body.country);
  const pathway = clean(body.pathway);
  const fullName = clean(body.fullName);
  const contactNumber = clean(body.contactNumber).replace(/[\s()-]/g, "");
  const accommodation = clean(body.accommodation);
  if (!UUID.test(id) || !Object.hasOwn(COUNTRY_CONTACTS, country) ||
      !Object.hasOwn(APPLICATION_CONSENTS, pathway) ||
      fullName.length < 2 || fullName.length > 150 ||
      !/^\+?\d{7,15}$/.test(contactNumber) || accommodation.length > 2000 ||
      body.requestContact !== true) {
    return res.status(400).json({ message: "Please provide your name, a valid contact number and country, and confirm that you want the programme team to contact you." });
  }
  const consent = getApplicationConsent(pathway);
  if (!consent.supportRequestOption) {
    return res.status(400).json({ message: "This pathway does not offer this contact request option." });
  }
  const data = { fullName, contactNumber, country, pathway, accommodation, consentVersion: consent.version };
  const payloadHash = crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
  try {
    let request;
    try {
      request = await prisma.consentSupportRequest.create({ data: { id, ...data, payloadHash } });
    } catch (error) {
      if (error.code !== "P2002") throw error;
      request = await prisma.consentSupportRequest.findUnique({ where: { id } });
      if (!request || request.payloadHash !== payloadHash) {
        return res.status(409).json({ message: "These details have changed. Please reload the page before sending a new request." });
      }
      // A retry after a lost response must not send another notification.
      return res.json({ success: true, reference: id });
    }
    let notificationStatus = "FAILED";
    try {
      const result = await sendEmail({
        to: COUNTRY_CONTACTS[country].questions,
        subject: `Digital Futures: consent explanation requested (${country})`,
        text: [
          "Please contact this person to explain the programme information before they decide whether to consent.",
          `Reference: ${id}`, `Name: ${fullName}`, `Phone: ${contactNumber}`,
          `Country: ${country}`, `Pathway: ${pathway}`,
          `Accommodation requested: ${accommodation || "None specified"}`,
          "This is a request for contact, not programme consent or a submitted application.",
          "After contact, ask the Super Admin to mark this request as contacted in the Consents area.",
        ].join("\n"),
      });
      notificationStatus = result.sent ? "SENT" : "FAILED";
    } catch {
      // The durable staff queue remains available even if SMTP fails.
      console.warn("Consent support notification failed", { requestId: id });
    }
    try {
      await prisma.consentSupportRequest.update({ where: { id }, data: { notificationStatus } });
    } catch {
      console.warn("Consent support notification status could not be recorded", { requestId: id });
    }
    return res.status(201).json({ success: true, reference: id });
  } catch {
    return res.status(500).json({ message: "Your request could not be saved. Please try again." });
  }
}

async function markSupportRequestContacted(req, res) {
  try {
    const result = await prisma.consentSupportRequest.updateMany({
      where: { id: req.params.id, status: "PENDING" },
      data: { status: "CONTACTED", contactedAt: new Date(), contactedBy: req.user.id },
    });
    if (!result.count) return res.status(404).json({ message: "Pending request not found. Refresh the list." });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ message: "Unable to update this contact request." });
  }
}

module.exports = { createSupportRequest, markSupportRequestContacted };
