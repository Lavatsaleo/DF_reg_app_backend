// Makes sure the private MinIO document bucket exists when the API starts, so a new environment works
// without a separate setup step. New buckets are private: no public read or listing.
const { HeadBucketCommand, CreateBucketCommand } = require("@aws-sdk/client-s3");
const { storageClient, storageConfig } = require("../config/storage");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureDocumentBucket({ attempts = 10, delayMs = 3000 } = {}) {
  const bucket = storageConfig.bucket;
  if (!bucket || !storageConfig.endpoint) return;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await storageClient.send(new HeadBucketCommand({ Bucket: bucket }));
      return;
    } catch (error) {
      const status = error?.$metadata?.httpStatusCode;
      if (status === 404 || error?.name === "NotFound" || error?.name === "NoSuchBucket") {
        try {
          await storageClient.send(new CreateBucketCommand({ Bucket: bucket }));
          console.log(`[storage] Created private bucket "${bucket}".`);
          return;
        } catch (createError) {
          console.warn(`[storage] Could not create bucket "${bucket}": ${createError.message}`);
          return;
        }
      }
      if (status === 403) {
        // The credentials may not allow HeadBucket; uploads will report any real problem.
        return;
      }
      if (attempt === attempts) {
        console.warn(`[storage] Document storage is not reachable (${error.message}). Uploads will fail until it is.`);
        return;
      }
      await sleep(delayMs);
    }
  }
}

module.exports = { ensureDocumentBucket };
