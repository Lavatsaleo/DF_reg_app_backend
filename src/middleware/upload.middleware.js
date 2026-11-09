const multer = require("multer");

// Applicants upload ID, education and disability documents: PDF or a photo only.
const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png"];

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
    fields: 50,
    fieldSize: 2 * 1024 * 1024,
    parts: 70,
  },
  // The declared type is only a first check; fileUpload.service verifies the file's actual content.
  fileFilter(req, file, callback) {
    if (!ALLOWED_UPLOAD_TYPES.includes(file.mimetype)) {
      const error = new Error("Only PDF, JPG or PNG files can be uploaded.");
      error.statusCode = 400;
      error.expose = true;
      return callback(error);
    }
    return callback(null, true);
  },
});

module.exports = upload;
module.exports.ALLOWED_UPLOAD_TYPES = ALLOWED_UPLOAD_TYPES;
