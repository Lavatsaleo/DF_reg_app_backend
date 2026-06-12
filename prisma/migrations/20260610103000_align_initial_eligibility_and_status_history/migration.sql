-- Align status history enum with the Applicant status enum.
-- This allows rare PENDING_REVIEW cases to be stored safely in ApplicantStatusHistory.

ALTER TABLE `ApplicantStatusHistory`
  MODIFY COLUMN `status` ENUM(
    'SUBMITTED',
    'PENDING_REVIEW',
    'INELIGIBLE',
    'ELIGIBLE_PENDING_SKILLS_TEST',
    'SKILLS_TEST_COMPLETED_PENDING_REVIEW',
    'ELIGIBLE_PENDING_DHIS2_SYNC',
    'SYNCED_TO_DHIS2_PENDING_REVIEW',
    'UNDER_REVIEW',
    'APPROVED_FOR_ENROLLMENT',
    'REJECTED_BY_REVIEW_COMMITTEE',
    'ENROLLED_IN_DHIS2_PROGRAM',
    'SYNC_FAILED'
  ) NOT NULL;
