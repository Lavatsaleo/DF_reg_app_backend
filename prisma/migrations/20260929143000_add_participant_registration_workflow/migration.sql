-- Add participant self-administered registration workflow for selected Physical/Virtual applicants.

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
    'PARTICIPANT_REGISTRATION_PENDING',
    'PARTICIPANT_REGISTRATION_COMPLETED_PENDING_VERIFICATION',
    'REJECTED_BY_REVIEW_COMMITTEE',
    'ENROLLED_IN_DHIS2_PROGRAM',
    'SYNC_FAILED'
  ) NOT NULL DEFAULT 'SUBMITTED';

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
    'PARTICIPANT_REGISTRATION_PENDING',
    'PARTICIPANT_REGISTRATION_COMPLETED_PENDING_VERIFICATION',
    'REJECTED_BY_REVIEW_COMMITTEE',
    'ENROLLED_IN_DHIS2_PROGRAM',
    'SYNC_FAILED'
  ) NOT NULL;

ALTER TABLE `RegistrationResponse`
  ADD COLUMN `formContext` VARCHAR(191) NULL DEFAULT 'APPLICATION';

CREATE TABLE `ParticipantRegistrationInvitation` (
  `id` VARCHAR(191) NOT NULL,
  `applicantId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `emailTo` VARCHAR(191) NULL,
  `formVersion` VARCHAR(191) NOT NULL DEFAULT 'DF-02-PARTICIPANT-REGISTRATION-BASELINE-V1.0-2026-09-29',
  `status` ENUM('PENDING', 'SENT', 'EMAIL_FAILED', 'OPENED', 'SUBMITTED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `sentAt` DATETIME(3) NULL,
  `openedAt` DATETIME(3) NULL,
  `submittedAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `emailError` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `ParticipantRegistrationInvitation_tokenHash_key`
  ON `ParticipantRegistrationInvitation`(`tokenHash`);
CREATE INDEX `ParticipantRegistrationInvitation_applicantId_idx`
  ON `ParticipantRegistrationInvitation`(`applicantId`);
CREATE INDEX `ParticipantRegistrationInvitation_status_idx`
  ON `ParticipantRegistrationInvitation`(`status`);
CREATE INDEX `ParticipantRegistrationInvitation_expiresAt_idx`
  ON `ParticipantRegistrationInvitation`(`expiresAt`);
CREATE INDEX `ParticipantRegistrationInvitation_sentAt_idx`
  ON `ParticipantRegistrationInvitation`(`sentAt`);
CREATE INDEX `ParticipantRegistrationInvitation_submittedAt_idx`
  ON `ParticipantRegistrationInvitation`(`submittedAt`);

ALTER TABLE `ParticipantRegistrationInvitation`
  ADD CONSTRAINT `ParticipantRegistrationInvitation_applicantId_fkey`
  FOREIGN KEY (`applicantId`) REFERENCES `Applicant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
