-- Add password reset token storage and SSO account-linking fields for staff users.
ALTER TABLE `StaffUser`
  MODIFY `passwordHash` VARCHAR(191) NULL,
  ADD COLUMN `authProvider` VARCHAR(191) NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN `externalSubject` VARCHAR(191) NULL,
  ADD COLUMN `lastPasswordResetAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `StaffUser_externalSubject_key` ON `StaffUser`(`externalSubject`);
CREATE INDEX `StaffUser_authProvider_idx` ON `StaffUser`(`authProvider`);

CREATE TABLE `PasswordResetToken` (
  `id` VARCHAR(191) NOT NULL,
  `staffUserId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `requestedIp` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
  INDEX `PasswordResetToken_staffUserId_idx`(`staffUserId`),
  INDEX `PasswordResetToken_expiresAt_idx`(`expiresAt`),
  INDEX `PasswordResetToken_usedAt_idx`(`usedAt`),
  INDEX `PasswordResetToken_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PasswordResetToken`
  ADD CONSTRAINT `PasswordResetToken_staffUserId_fkey`
  FOREIGN KEY (`staffUserId`) REFERENCES `StaffUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
