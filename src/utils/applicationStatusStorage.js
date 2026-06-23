const SUBMITTED_APPLICATIONS_KEY = "sightsavers-submitted-applications";

function readApplications() {
  try {
    const rawValue = window.localStorage.getItem(SUBMITTED_APPLICATIONS_KEY);
    if (!rawValue) return [];

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch (error) {
    console.warn("Unable to read saved application confirmations", error);
    return [];
  }
}


function normalizePhoneNumber(value) {
  const digitsOnly = String(value || "").replace(/\D/g, "");
  return digitsOnly || "";
}

function isTrackableApplication(application) {
  return Boolean(
    application?.applicationReference &&
    application?.allowStatusCheck !== false &&
    application?.status !== "INELIGIBLE" &&
    application?.screeningStatus !== "NOT_ELIGIBLE"
  );
}

function writeApplications(applications) {
  try {
    window.localStorage.setItem(
      SUBMITTED_APPLICATIONS_KEY,
      JSON.stringify(applications.slice(0, 20))
    );
  } catch (error) {
    console.warn("Unable to save application confirmation", error);
  }
}

export function saveSubmittedApplication(result, selectedPathway) {
  if (!isTrackableApplication(result)) return;

  const applications = readApplications();
  const normalizedReference = String(result.applicationReference).trim().toUpperCase();

  const savedApplication = {
    ...result,
    applicationReference: normalizedReference,
    pathwayTitle: selectedPathway?.title || result.pathwayTitle || result.pathway,
    savedAt: new Date().toISOString(),
  };

  const withoutDuplicate = applications.filter(
    (application) =>
      String(application.applicationReference || "").trim().toUpperCase() !== normalizedReference
  );

  writeApplications([savedApplication, ...withoutDuplicate]);
}

export function findSubmittedApplication(identifier) {
  if (!identifier) return null;

  const normalizedReference = String(identifier).trim().toUpperCase();
  const normalizedPhone = normalizePhoneNumber(identifier);

  return (
    readApplications().find((application) => {
      if (!isTrackableApplication(application)) return false;

      const referenceMatches =
        String(application.applicationReference || "").trim().toUpperCase() === normalizedReference;
      const phoneMatches =
        normalizedPhone.length >= 7 &&
        normalizePhoneNumber(application.contactNumber) === normalizedPhone;

      return referenceMatches || phoneMatches;
    }) || null
  );
}

export function listSubmittedApplications() {
  return readApplications().filter(isTrackableApplication);
}
