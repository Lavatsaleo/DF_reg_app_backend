const STATUS_LABELS = {
  SUBMITTED: "Submitted",
  PENDING_REVIEW: "Pending review",
  ELIGIBLE: "Eligible",
  NOT_ELIGIBLE: "Not eligible",
  INELIGIBLE: "Not eligible",
  ELIGIBLE_PENDING_SKILLS_TEST: "Eligible — pending IT skills test",
  SKILLS_TEST_COMPLETED_PENDING_REVIEW: "IT skills test completed — pending review",
  SYNCED_TO_DHIS2_PENDING_REVIEW: "Pending committee review",
  UNDER_REVIEW: "Under committee review",
  APPROVED: "Approved",
  APPROVED_FOR_ENROLLMENT: "Approved for enrollment",
  REJECTED: "Rejected",
  REJECTED_BY_REVIEW_COMMITTEE: "Not selected",
  ENROLLED: "Enrolled",
  ENROLLED_IN_DHIS2: "Enrolled",
  ENROLLED_IN_DHIS2_PROGRAM: "Enrolled in programme",
};

const PATHWAY_LABELS = {
  PHYSICAL_ACADEMY: "Physical Academy",
  PHYSICAL: "Physical Academy",
  VIRTUAL_ACADEMY: "Virtual Academy",
  DIGITAL_ENTREPRENEURSHIP: "Digital Entrepreneurship",
};

function toTitleCase(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatStatusLabel(value) {
  if (!value) return "Submitted";

  const normalized = String(value).trim().toUpperCase().replace(/[\s-]+/g, "_");
  return STATUS_LABELS[normalized] || toTitleCase(value);
}

export function formatPathwayLabel(value, fallback = "Physical Academy") {
  if (!value) return fallback;

  const normalized = String(value).trim().toUpperCase().replace(/[\s-]+/g, "_");
  return PATHWAY_LABELS[normalized] || toTitleCase(value);
}
