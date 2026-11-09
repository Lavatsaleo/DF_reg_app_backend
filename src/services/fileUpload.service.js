const { PutObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");
const s3Client = require("../config/s3");

const DOCUMENT_TYPES = [
  "NATIONAL_ID",
  "PASSPORT",
  "BIRTH_CERTIFICATE",
  "MEDICAL_DOCUMENT",
  "REFERRAL_LETTER",
  "CONSENT_FORM",
  "DISABILITY_DOCUMENT",
  "EDUCATION_CERTIFICATE",
  "OTHER",
];

// Identify a file by its first bytes, never by the name or type the browser reported.
function detectFileType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) return null;
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") {
    return { mimeType: "application/pdf", extension: ".pdf" };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: ".jpg" };
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: "image/png", extension: ".png" };
  }
  return null;
}

function normalizeDocumentType(value) {
  const type = String(value || "").trim().toUpperCase();
  return DOCUMENT_TYPES.includes(type) ? type : "OTHER";
}

// Keeps the original name for staff to read, without path parts or control characters.
function cleanOriginalName(name) {
  const base = String(name || "document").split(/[\\/]/).pop();
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").trim();
  return (clean || "document").slice(0, 200);
}

function rejectFile(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.expose = true;
  return error;
}

async function uploadFileToS3(file, applicantId, documentType = "OTHER") {
  const bucket = process.env.S3_BUCKET;

  if (!bucket) {
    throw new Error("S3_BUCKET is not configured in .env");
  }

  const detected = detectFileType(file?.buffer);
  if (!detected) {
    throw rejectFile("This file is not a valid PDF, JPG or PNG document.");
  }

  // The storage path is built only from server-controlled values.
  const safeType = normalizeDocumentType(documentType);
  const safeApplicantId = String(applicantId).replace(/[^a-zA-Z0-9-]/g, "");
  const safeFileName = `${crypto.randomUUID()}${detected.extension}`;
  const storageKey = `applicants/${safeApplicantId}/${safeType}/${safeFileName}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    Body: file.buffer,
    ContentType: detected.mimeType,
    // Opened from storage, a document downloads rather than rendering in the storage domain.
    ContentDisposition: "attachment",
    ServerSideEncryption: process.env.S3_SERVER_SIDE_ENCRYPTION || undefined,
  });

  await s3Client.send(command);

  const storageUrl = `${process.env.S3_ENDPOINT}/${bucket}/${storageKey}`;

  return {
    storageBucket: bucket,
    storageKey,
    storageUrl,
    fileName: safeFileName,
    mimeType: detected.mimeType,
    originalName: cleanOriginalName(file.originalname),
    documentType: safeType,
  };
}

module.exports = {
  uploadFileToS3,
  detectFileType,
  normalizeDocumentType,
  cleanOriginalName,
  DOCUMENT_TYPES,
};
