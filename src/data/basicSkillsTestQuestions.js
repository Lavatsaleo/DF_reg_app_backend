// IT skills assessment configuration from the DigComp 3.0 question bank guidance (October 2026).
// Every applicant gets 30 questions drawn by fixed domain quotas; 1 mark per correct answer, pass mark 22/30.
// These values are programme policy, so they are not read from .env.
const BASIC_SKILLS_TEST_VERSION = "DF_IT_DIGCOMP3_BANK_20261021";
const BASIC_SKILLS_TEST_LENGTH = 30;
const BASIC_SKILLS_TEST_PASS_MARK = 22;
const BASIC_SKILLS_TEST_PASSING_PERCENTAGE =
  Math.round((BASIC_SKILLS_TEST_PASS_MARK / BASIC_SKILLS_TEST_LENGTH) * 10000) / 100;

const BASIC_SKILLS_TEST_BLUEPRINT = [
  {
    key: "deviceFileOperations",
    category: "Device and file operations",
    count: 7,
    domains: ["Device & File Operations"],
  },
  {
    key: "informationSearch",
    category: "Information and search",
    count: 4,
    domains: ["Information & Search"],
  },
  {
    key: "communicationOnlineLearning",
    category: "Communication and online learning",
    count: 5,
    domains: ["Communication & Online Learning"],
  },
  {
    key: "safetyPrivacy",
    category: "Safety and privacy",
    count: 4,
    domains: ["Safety & Privacy"],
  },
  {
    key: "productivityContent",
    category: "Productivity and content",
    count: 5,
    domains: ["Productivity & Content"],
  },
  {
    key: "troubleshootingConnectivity",
    category: "Troubleshooting and connectivity",
    count: 5,
    domains: ["Troubleshooting & Connectivity"],
  },
];

function getBlueprintTotalQuestions() {
  return BASIC_SKILLS_TEST_BLUEPRINT.reduce(
    (sum, item) => sum + Number(item.count || 0),
    0
  );
}

// Attempts store the percentage threshold they were scored against; this gives the pass mark in points.
function getAttemptPassMark(attempt) {
  if (!attempt?.maxScore) return null;
  return Math.round((Number(attempt.passingPercentage || 0) * Number(attempt.maxScore)) / 100);
}

module.exports = {
  BASIC_SKILLS_TEST_BLUEPRINT,
  BASIC_SKILLS_TEST_LENGTH,
  BASIC_SKILLS_TEST_PASS_MARK,
  BASIC_SKILLS_TEST_PASSING_PERCENTAGE,
  BASIC_SKILLS_TEST_VERSION,
  getAttemptPassMark,
  getBlueprintTotalQuestions,
};
