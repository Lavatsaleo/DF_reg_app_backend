-- Add exam workflow statuses to applicant status enum
ALTER TABLE `Applicant`
  MODIFY COLUMN `status` ENUM(
    'SUBMITTED',
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

ALTER TABLE `ApplicantStatusHistory`
  MODIFY COLUMN `status` ENUM(
    'SUBMITTED',
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

-- Store submitted basic IT skills test attempts and answers
CREATE TABLE `BasicSkillsTestAttempt` (
  `id` VARCHAR(191) NOT NULL,
  `applicantId` VARCHAR(191) NOT NULL,
  `attemptNumber` INTEGER NOT NULL DEFAULT 1,
  `status` ENUM('SUBMITTED') NOT NULL DEFAULT 'SUBMITTED',
  `score` DOUBLE NOT NULL DEFAULT 0,
  `maxScore` DOUBLE NOT NULL DEFAULT 0,
  `percentage` DOUBLE NOT NULL DEFAULT 0,
  `passed` BOOLEAN NOT NULL DEFAULT false,
  `passingPercentage` DOUBLE NOT NULL DEFAULT 50,
  `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `durationSeconds` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `BasicSkillsTestAttempt_applicantId_attemptNumber_key`(`applicantId`, `attemptNumber`),
  INDEX `BasicSkillsTestAttempt_applicantId_idx`(`applicantId`),
  INDEX `BasicSkillsTestAttempt_passed_idx`(`passed`),
  INDEX `BasicSkillsTestAttempt_submittedAt_idx`(`submittedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BasicSkillsTestAnswer` (
  `id` VARCHAR(191) NOT NULL,
  `attemptId` VARCHAR(191) NOT NULL,
  `questionCode` VARCHAR(191) NOT NULL,
  `questionText` TEXT NOT NULL,
  `category` VARCHAR(191) NULL,
  `selectedAnswer` TEXT NOT NULL,
  `correctAnswer` TEXT NOT NULL,
  `isCorrect` BOOLEAN NOT NULL DEFAULT false,
  `pointsAwarded` DOUBLE NOT NULL DEFAULT 0,
  `pointsPossible` DOUBLE NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `BasicSkillsTestAnswer_attemptId_idx`(`attemptId`),
  INDEX `BasicSkillsTestAnswer_questionCode_idx`(`questionCode`),
  INDEX `BasicSkillsTestAnswer_isCorrect_idx`(`isCorrect`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `BasicSkillsTestAttempt`
  ADD CONSTRAINT `BasicSkillsTestAttempt_applicantId_fkey`
  FOREIGN KEY (`applicantId`) REFERENCES `Applicant`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `BasicSkillsTestAnswer`
  ADD CONSTRAINT `BasicSkillsTestAnswer_attemptId_fkey`
  FOREIGN KEY (`attemptId`) REFERENCES `BasicSkillsTestAttempt`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
