const BASIC_SKILLS_TEST_PASSING_PERCENTAGE = Number(
  process.env.BASIC_SKILLS_TEST_PASSING_PERCENTAGE || 60
);
const BASIC_SKILLS_TEST_VERSION =
  process.env.BASIC_SKILLS_TEST_VERSION || "BASIC_IT_SKILLS_BANK_V1";
const BASIC_SKILLS_TEST_LENGTH = Number(process.env.BASIC_SKILLS_TEST_LENGTH || 10);

const BASIC_SKILLS_TEST_BLUEPRINT = [
  {
    key: "computerDesktopBasics",
    category: "Computer and desktop basics",
    count: 2,
    domains: [
      "Computer & Device Basics",
      "Operating System & Desktop Navigation",
    ],
  },
  {
    key: "fileFolderManagement",
    category: "File and folder management",
    count: 1,
    domains: ["File & Folder Management"],
  },
  {
    key: "internetEmail",
    category: "Internet and email",
    count: 2,
    domains: [
      "Internet & Information Search",
      "Email & Digital Communication",
    ],
  },
  {
    key: "onlineSafetyPrivacy",
    category: "Online safety and privacy",
    count: 2,
    domains: ["Online Safety, Privacy & Security"],
  },
  {
    key: "productivityTools",
    category: "Productivity tools",
    count: 1,
    domains: [
      "Word Processing & Documents",
      "Spreadsheets & Data Basics",
      "Presentations & Digital Content Creation",
    ],
  },
  {
    key: "onlineFormsMobileServices",
    category: "Online forms, mobile, and digital services",
    count: 1,
    domains: [
      "Online Forms & Digital Services",
      "Mobile, Connectivity & Digital Services",
    ],
  },
  {
    key: "troubleshootingProblemSolving",
    category: "Troubleshooting and problem solving",
    count: 1,
    domains: ["Problem Solving & Troubleshooting"],
  },
];

function getBlueprintTotalQuestions() {
  return BASIC_SKILLS_TEST_BLUEPRINT.reduce(
    (sum, item) => sum + Number(item.count || 0),
    0
  );
}

module.exports = {
  BASIC_SKILLS_TEST_BLUEPRINT,
  BASIC_SKILLS_TEST_LENGTH,
  BASIC_SKILLS_TEST_PASSING_PERCENTAGE,
  BASIC_SKILLS_TEST_VERSION,
  getBlueprintTotalQuestions,
};
