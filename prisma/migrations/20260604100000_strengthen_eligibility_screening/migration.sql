-- Strengthen first-contact eligibility screening and participant tracking.
-- This is intentionally additive so existing registration and test workflows keep working.

ALTER TABLE `Applicant`
  MODIFY `status` ENUM(
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
  ) NOT NULL DEFAULT 'SUBMITTED';

ALTER TABLE `Applicant`
  ADD COLUMN `dateOfBirth` DATETIME(3) NULL,
  ADD COLUMN `ageAtApplication` INTEGER NULL,
  ADD COLUMN `screeningStatus` VARCHAR(191) NULL DEFAULT 'PENDING_REVIEW',
  ADD COLUMN `screeningVersion` VARCHAR(191) NULL DEFAULT 'PHYSICAL_ACADEMY_V1',
  ADD COLUMN `screenedAt` DATETIME(3) NULL,
  ADD COLUMN `eligibilityReasonCodes` JSON NULL,
  ADD COLUMN `eligibilityDetails` JSON NULL,
  ADD COLUMN `possibleDuplicateOfApplicantId` VARCHAR(191) NULL,
  ADD COLUMN `duplicateCheckStatus` VARCHAR(191) NULL DEFAULT 'NO_MATCH',
  ADD COLUMN `nextOfKinName` VARCHAR(191) NULL,
  ADD COLUMN `nextOfKinPhone` VARCHAR(191) NULL,
  ADD COLUMN `nextOfKinRelationship` VARCHAR(191) NULL,
  ADD COLUMN `preferredContactMethod` VARCHAR(191) NULL,
  ADD COLUMN `consentedAt` DATETIME(3) NULL;

CREATE INDEX `Applicant_screeningStatus_idx` ON `Applicant`(`screeningStatus`);
CREATE INDEX `Applicant_screenedAt_idx` ON `Applicant`(`screenedAt`);
CREATE INDEX `Applicant_duplicateCheckStatus_idx` ON `Applicant`(`duplicateCheckStatus`);
CREATE INDEX `Applicant_possibleDuplicateOfApplicantId_idx` ON `Applicant`(`possibleDuplicateOfApplicantId`);

ALTER TABLE `BasicSkillsTestAttempt`
  ADD COLUMN `testVersion` VARCHAR(191) NULL DEFAULT 'BASIC_IT_SKILLS_V1';
