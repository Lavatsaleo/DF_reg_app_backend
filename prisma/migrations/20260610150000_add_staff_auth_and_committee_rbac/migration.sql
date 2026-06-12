-- Add internal staff users for protected committee access and role-based access control.
CREATE TABLE `StaffUser` (
  `id` VARCHAR(191) NOT NULL,
  `fullName` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `role` ENUM('ADMIN', 'COMMITTEE_CHAIRPERSON', 'COMMITTEE_MEMBER', 'VIEWER') NOT NULL DEFAULT 'COMMITTEE_MEMBER',
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `committeeMemberId` VARCHAR(191) NULL,
  `lastLoginAt` DATETIME(3) NULL,
  `tokenVersion` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `StaffUser_email_key`(`email`),
  INDEX `StaffUser_role_idx`(`role`),
  INDEX `StaffUser_isActive_idx`(`isActive`),
  INDEX `StaffUser_committeeMemberId_idx`(`committeeMemberId`),
  INDEX `StaffUser_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `StaffUser`
  ADD CONSTRAINT `StaffUser_committeeMemberId_fkey`
  FOREIGN KEY (`committeeMemberId`) REFERENCES `CommitteeMember`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
