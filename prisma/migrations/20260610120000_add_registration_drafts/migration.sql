-- Server-side incomplete application drafts.
-- Drafts allow an applicant to save an incomplete registration and resume later
-- using the same mobile number from the status page.

CREATE TABLE `RegistrationDraft` (
  `id` VARCHAR(191) NOT NULL,
  `draftReference` VARCHAR(191) NOT NULL,
  `pathway` ENUM('PHYSICAL_ACADEMY', 'VIRTUAL_ACADEMY', 'DIGITAL_ENTREPRENEURSHIP', 'UNKNOWN') NOT NULL DEFAULT 'PHYSICAL_ACADEMY',
  `contactNumber` VARCHAR(191) NULL,
  `normalizedContactNumber` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `normalizedEmail` VARCHAR(191) NULL,
  `answers` JSON NOT NULL,
  `documentType` VARCHAR(191) NULL,
  `currentStep` INTEGER NOT NULL DEFAULT 0,
  `completionPercent` INTEGER NOT NULL DEFAULT 0,
  `status` VARCHAR(191) NOT NULL DEFAULT 'INCOMPLETE',
  `lastSavedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `submittedApplicantId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `RegistrationDraft_draftReference_key`(`draftReference`),
  UNIQUE INDEX `RegistrationDraft_normalizedContactNumber_key`(`normalizedContactNumber`),
  INDEX `RegistrationDraft_normalizedEmail_idx`(`normalizedEmail`),
  INDEX `RegistrationDraft_status_idx`(`status`),
  INDEX `RegistrationDraft_lastSavedAt_idx`(`lastSavedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
