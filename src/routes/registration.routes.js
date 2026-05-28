const express = require("express");
const upload = require("../middleware/upload.middleware");

const {
  submitRegistration,
  getApplicants,
  getApplicantById,
  getRegistrationStatus,
  getRegistrationFormQuestions,
} = require("../controllers/registration.controller");

const router = express.Router();

router.get("/form/questions", getRegistrationFormQuestions);

router.post("/", upload.array("documents", 10), submitRegistration);

router.get("/", getApplicants);

// Must come before /:id so Express does not treat "status" as an applicant id.
router.get("/status/:reference", getRegistrationStatus);

router.get("/:id", getApplicantById);

module.exports = router;