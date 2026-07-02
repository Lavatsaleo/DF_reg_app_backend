-- Add a database-backed Basic IT skills question bank and store the exact
-- randomized questions selected for each applicant attempt.

ALTER TABLE `BasicSkillsTestAttempt`
  MODIFY COLUMN `status` ENUM('IN_PROGRESS', 'SUBMITTED') NOT NULL DEFAULT 'IN_PROGRESS';

ALTER TABLE `BasicSkillsTestAttempt`
  MODIFY COLUMN `submittedAt` DATETIME(3) NULL;

ALTER TABLE `BasicSkillsTestAttempt`
  MODIFY COLUMN `passingPercentage` DOUBLE NOT NULL DEFAULT 60;

ALTER TABLE `BasicSkillsTestAttempt`
  MODIFY COLUMN `testVersion` VARCHAR(191) NULL DEFAULT 'BASIC_IT_SKILLS_BANK_V1';

CREATE TABLE `BasicSkillsTestQuestion` (
  `id` VARCHAR(191) NOT NULL,
  `questionCode` VARCHAR(191) NOT NULL,
  `domain` VARCHAR(191) NOT NULL,
  `competencyArea` VARCHAR(191) NULL,
  `difficulty` VARCHAR(191) NULL,
  `questionText` TEXT NOT NULL,
  `optionA` TEXT NOT NULL,
  `optionB` TEXT NOT NULL,
  `optionC` TEXT NOT NULL,
  `optionD` TEXT NOT NULL,
  `correctOption` VARCHAR(191) NOT NULL,
  `correctAnswer` TEXT NOT NULL,
  `explanation` TEXT NULL,
  `sourceFrameworks` TEXT NULL,
  `sourceUrl` TEXT NULL,
  `adaptationNote` TEXT NULL,
  `recommendedFor` VARCHAR(191) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `scoreWeight` DOUBLE NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `BasicSkillsTestQuestion_questionCode_key`(`questionCode`),
  INDEX `BasicSkillsTestQuestion_domain_idx`(`domain`),
  INDEX `BasicSkillsTestQuestion_difficulty_idx`(`difficulty`),
  INDEX `BasicSkillsTestQuestion_active_idx`(`active`),
  INDEX `BasicSkillsTestQuestion_recommendedFor_idx`(`recommendedFor`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BasicSkillsTestAttemptQuestion` (
  `id` VARCHAR(191) NOT NULL,
  `attemptId` VARCHAR(191) NOT NULL,
  `questionId` VARCHAR(191) NULL,
  `questionCode` VARCHAR(191) NOT NULL,
  `questionNumber` INTEGER NOT NULL,
  `domain` VARCHAR(191) NULL,
  `category` VARCHAR(191) NULL,
  `difficulty` VARCHAR(191) NULL,
  `questionText` TEXT NOT NULL,
  `options` JSON NOT NULL,
  `correctOption` VARCHAR(191) NOT NULL,
  `correctAnswer` TEXT NOT NULL,
  `pointsPossible` DOUBLE NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `BasicSkillsTestAttemptQuestion_attemptId_questionCode_key`(`attemptId`, `questionCode`),
  INDEX `BasicSkillsTestAttemptQuestion_attemptId_idx`(`attemptId`),
  INDEX `BasicSkillsTestAttemptQuestion_questionId_idx`(`questionId`),
  INDEX `BasicSkillsTestAttemptQuestion_questionCode_idx`(`questionCode`),
  INDEX `BasicSkillsTestAttemptQuestion_domain_idx`(`domain`),
  INDEX `BasicSkillsTestAttemptQuestion_category_idx`(`category`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `BasicSkillsTestAttemptQuestion`
  ADD CONSTRAINT `BasicSkillsTestAttemptQuestion_attemptId_fkey`
  FOREIGN KEY (`attemptId`) REFERENCES `BasicSkillsTestAttempt`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `BasicSkillsTestAttemptQuestion`
  ADD CONSTRAINT `BasicSkillsTestAttemptQuestion_questionId_fkey`
  FOREIGN KEY (`questionId`) REFERENCES `BasicSkillsTestQuestion`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
