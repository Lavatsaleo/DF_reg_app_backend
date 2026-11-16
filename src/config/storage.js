// Document storage: MinIO. The client library is the standard one MinIO is accessed with.
const { S3Client } = require("@aws-sdk/client-s3");

// Older deployments used S3_* names for the same settings; they still work until each server's .env is
// updated, with a warning so they get renamed.
const LEGACY_NAMES = {
  MINIO_ENDPOINT: "S3_ENDPOINT",
  MINIO_ACCESS_KEY: "S3_ACCESS_KEY",
  MINIO_SECRET_KEY: "S3_SECRET_KEY",
  MINIO_BUCKET: "S3_BUCKET",
};

function setting(name) {
  if (process.env[name]) return process.env[name];
  const legacy = process.env[LEGACY_NAMES[name]];
  if (legacy) {
    console.warn(`[storage] ${LEGACY_NAMES[name]} is deprecated; rename it to ${name} in .env.`);
    return legacy;
  }
  return "";
}

const storageConfig = {
  endpoint: setting("MINIO_ENDPOINT").replace(/\/+$/, ""),
  bucket: setting("MINIO_BUCKET"),
  accessKey: setting("MINIO_ACCESS_KEY"),
  secretKey: setting("MINIO_SECRET_KEY"),
};

const storageClient = new S3Client({
  endpoint: storageConfig.endpoint || undefined,
  // MinIO ignores the region, but the client library requires one.
  region: "us-east-1",
  // MinIO addresses buckets by path (http://minio:9000/bucket/key).
  forcePathStyle: true,
  credentials: {
    accessKeyId: storageConfig.accessKey,
    secretAccessKey: storageConfig.secretKey,
  },
});

module.exports = { storageClient, storageConfig };
