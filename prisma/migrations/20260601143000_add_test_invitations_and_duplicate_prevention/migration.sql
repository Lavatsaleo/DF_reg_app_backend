-- Add normalized duplicate-prevention fields to applicants.
ALTER TABLE `Applicant`
  ADD COLUMN `normalizedEmail` VARCHAR(191) NULL,
  ADD COLUMN `normalizedContactNumber` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Applicant_normalizedEmail_key` ON `Applicant`(`normalizedEmail`);
CREATE UNIQUE INDEX `Applicant_normalizedContactNumber_key` ON `Applicant`(`normalizedContactNumber`);
-- Store one-time Basic IT skills test invitations.
CREATE TABLE `BasicSkillsTestInvitation` (
  `id` VARCHAR(191) NOT NULL,
  `applicantId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `emailTo` VARCHAR(191) NULL,
  `invitationUrl` TEXT NULL,
  `status` ENUM('PENDING', 'SENT', 'EMAIL_FAILED', 'OPENED', 'USED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `sentAt` DATETIME(3) NULL,
  `openedAt` DATETIME(3) NULL,
  `usedAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `emailError` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `BasicSkillsTestInvitation_tokenHash_key` ON `BasicSkillsTestInvitation`(`tokenHash`);
CREATE INDEX `BasicSkillsTestInvitation_applicantId_idx` ON `BasicSkillsTestInvitation`(`applicantId`);
CREATE INDEX `BasicSkillsTestInvitation_status_idx` ON `BasicSkillsTestInvitation`(`status`);
CREATE INDEX `BasicSkillsTestInvitation_expiresAt_idx` ON `BasicSkillsTestInvitation`(`expiresAt`);
CREATE INDEX `BasicSkillsTestInvitation_sentAt_idx` ON `BasicSkillsTestInvitation`(`sentAt`);

ALTER TABLE `BasicSkillsTestInvitation`
  ADD CONSTRAINT `BasicSkillsTestInvitation_applicantId_fkey`
  FOREIGN KEY (`applicantId`) REFERENCES `Applicant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Link a submitted attempt back to the invitation that opened the test.
ALTER TABLE `BasicSkillsTestAttempt`
  ADD COLUMN `invitationId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `BasicSkillsTestAttempt_invitationId_key` ON `BasicSkillsTestAttempt`(`invitationId`);
ALTER TABLE `BasicSkillsTestAttempt`
  ADD CONSTRAINT `BasicSkillsTestAttempt_invitationId_fkey`
  FOREIGN KEY (`invitationId`) REFERENCES `BasicSkillsTestInvitation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
