const { PutObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");
const path = require("path");
const s3Client = require("../config/s3");

async function uploadFileToS3(file, applicantId, documentType = "OTHER") {
  const bucket = process.env.S3_BUCKET;

  if (!bucket) {
    throw new Error("S3_BUCKET is not configured in .env");
  }

  const extension = path.extname(file.originalname);
  const safeFileName = `${crypto.randomUUID()}${extension}`;

  const storageKey = `applicants/${applicantId}/${documentType}/${safeFileName}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3Client.send(command);

  const storageUrl = `${process.env.S3_ENDPOINT}/${bucket}/${storageKey}`;

  return {
    storageBucket: bucket,
    storageKey,
    storageUrl,
    fileName: safeFileName,
  };
}

module.exports = {
  uploadFileToS3,
};