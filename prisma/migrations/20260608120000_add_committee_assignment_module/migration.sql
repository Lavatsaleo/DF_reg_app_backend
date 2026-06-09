-- Committee review assignment module
-- Adds committee members, current applicant assignments, review decisions, and reassignment history.

CREATE TABLE `CommitteeMember` (
  `id` VARCHAR(191) NOT NULL,
  `fullName` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NULL,
  `role` VARCHAR(191) NOT NULL DEFAULT 'MEMBER',
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `CommitteeMember_email_key`(`email`),
  INDEX `CommitteeMember_role_idx`(`role`),
  INDEX `CommitteeMember_isActive_idx`(`isActive`),
  INDEX `CommitteeMember_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CommitteeAssignment` (
  `id` VARCHAR(191) NOT NULL,
  `applicantId` VARCHAR(191) NOT NULL,
  `committeeMemberId` VARCHAR(191) NOT NULL,
  `assignedByType` VARCHAR(191) NOT NULL DEFAULT 'SYSTEM',
  `assignedByMemberId` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'ASSIGNED',
  `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `CommitteeAssignment_applicantId_key`(`applicantId`),
  INDEX `CommitteeAssignment_committeeMemberId_idx`(`committeeMemberId`),
  INDEX `CommitteeAssignment_assignedByMemberId_idx`(`assignedByMemberId`),
  INDEX `CommitteeAssignment_status_idx`(`status`),
  INDEX `CommitteeAssignment_assignedAt_idx`(`assignedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CommitteeReview` (
  `id` VARCHAR(191) NOT NULL,
  `assignmentId` VARCHAR(191) NOT NULL,
  `applicantId` VARCHAR(191) NOT NULL,
  `committeeMemberId` VARCHAR(191) NOT NULL,
  `decision` VARCHAR(191) NOT NULL,
  `comments` TEXT NULL,
  `reviewedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `CommitteeReview_assignmentId_key`(`assignmentId`),
  INDEX `CommitteeReview_applicantId_idx`(`applicantId`),
  INDEX `CommitteeReview_committeeMemberId_idx`(`committeeMemberId`),
  INDEX `CommitteeReview_decision_idx`(`decision`),
  INDEX `CommitteeReview_reviewedAt_idx`(`reviewedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CommitteeAssignmentHistory` (
  `id` VARCHAR(191) NOT NULL,
  `assignmentId` VARCHAR(191) NULL,
  `applicantId` VARCHAR(191) NOT NULL,
  `fromCommitteeMemberId` VARCHAR(191) NULL,
  `toCommitteeMemberId` VARCHAR(191) NOT NULL,
  `changedByMemberId` VARCHAR(191) NULL,
  `changeType` VARCHAR(191) NOT NULL DEFAULT 'ASSIGNED',
  `reason` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `CommitteeAssignmentHistory_assignmentId_idx`(`assignmentId`),
  INDEX `CommitteeAssignmentHistory_applicantId_idx`(`applicantId`),
  INDEX `CommitteeAssignmentHistory_fromCommitteeMemberId_idx`(`fromCommitteeMemberId`),
  INDEX `CommitteeAssignmentHistory_toCommitteeMemberId_idx`(`toCommitteeMemberId`),
  INDEX `CommitteeAssignmentHistory_changedByMemberId_idx`(`changedByMemberId`),
  INDEX `CommitteeAssignmentHistory_changeType_idx`(`changeType`),
  INDEX `CommitteeAssignmentHistory_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CommitteeAssignment`
  ADD CONSTRAINT `CommitteeAssignment_applicantId_fkey`
  FOREIGN KEY (`applicantId`) REFERENCES `Applicant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CommitteeAssignment`
  ADD CONSTRAINT `CommitteeAssignment_committeeMemberId_fkey`
  FOREIGN KEY (`committeeMemberId`) REFERENCES `CommitteeMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CommitteeAssignment`
  ADD CONSTRAINT `CommitteeAssignment_assignedByMemberId_fkey`
  FOREIGN KEY (`assignedByMemberId`) REFERENCES `CommitteeMember`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CommitteeReview`
  ADD CONSTRAINT `CommitteeReview_assignmentId_fkey`
  FOREIGN KEY (`assignmentId`) REFERENCES `CommitteeAssignment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CommitteeReview`
  ADD CONSTRAINT `CommitteeReview_applicantId_fkey`
  FOREIGN KEY (`applicantId`) REFERENCES `Applicant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CommitteeReview`
  ADD CONSTRAINT `CommitteeReview_committeeMemberId_fkey`
  FOREIGN KEY (`committeeMemberId`) REFERENCES `CommitteeMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CommitteeAssignmentHistory`
  ADD CONSTRAINT `CommitteeAssignmentHistory_assignmentId_fkey`
  FOREIGN KEY (`assignmentId`) REFERENCES `CommitteeAssignment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CommitteeAssignmentHistory`
  ADD CONSTRAINT `CommitteeAssignmentHistory_applicantId_fkey`
  FOREIGN KEY (`applicantId`) REFERENCES `Applicant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CommitteeAssignmentHistory`
  ADD CONSTRAINT `CommitteeAssignmentHistory_fromCommitteeMemberId_fkey`
  FOREIGN KEY (`fromCommitteeMemberId`) REFERENCES `CommitteeMember`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CommitteeAssignmentHistory`
  ADD CONSTRAINT `CommitteeAssignmentHistory_toCommitteeMemberId_fkey`
  FOREIGN KEY (`toCommitteeMemberId`) REFERENCES `CommitteeMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CommitteeAssignmentHistory`
  ADD CONSTRAINT `CommitteeAssignmentHistory_changedByMemberId_fkey`
  FOREIGN KEY (`changedByMemberId`) REFERENCES `CommitteeMember`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
