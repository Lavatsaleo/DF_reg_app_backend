-- Add tracking identifiers to applicants
ALTER TABLE `Applicant`
  ADD COLUMN `participantCode` VARCHAR(191) NULL,
  ADD COLUMN `applicationReference` VARCHAR(191) NULL;

-- Create unique indexes for the new identifiers
CREATE UNIQUE INDEX `Applicant_participantCode_key` ON `Applicant`(`participantCode`);
CREATE UNIQUE INDEX `Applicant_applicationReference_key` ON `Applicant`(`applicationReference`);

-- Create sequence counter table for safe participant numbering
CREATE TABLE `SequenceCounter` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `value` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `SequenceCounter_name_key`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create applicant status history table for timeline/status tracking
CREATE TABLE `ApplicantStatusHistory` (
  `id` VARCHAR(191) NOT NULL,
  `applicantId` VARCHAR(191) NOT NULL,
  `status` ENUM('SUBMITTED', 'INELIGIBLE', 'ELIGIBLE_PENDING_DHIS2_SYNC', 'SYNCED_TO_DHIS2_PENDING_REVIEW', 'UNDER_REVIEW', 'APPROVED_FOR_ENROLLMENT', 'REJECTED_BY_REVIEW_COMMITTEE', 'ENROLLED_IN_DHIS2_PROGRAM', 'SYNC_FAILED') NOT NULL,
  `note` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ApplicantStatusHistory_applicantId_idx`(`applicantId`),
  INDEX `ApplicantStatusHistory_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Link status history records to applicants
ALTER TABLE `ApplicantStatusHistory`
  ADD CONSTRAINT `ApplicantStatusHistory_applicantId_fkey`
  FOREIGN KEY (`applicantId`) REFERENCES `Applicant`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
