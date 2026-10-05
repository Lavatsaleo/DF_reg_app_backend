CREATE TABLE `ConsentSupportRequest` (
  `id` VARCHAR(191) NOT NULL,
  `fullName` VARCHAR(191) NOT NULL,
  `contactNumber` VARCHAR(191) NOT NULL,
  `country` VARCHAR(191) NOT NULL,
  `pathway` VARCHAR(191) NOT NULL,
  `accommodation` TEXT NULL,
  `consentVersion` VARCHAR(191) NOT NULL,
  `payloadHash` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `notificationStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `contactedAt` DATETIME(3) NULL,
  `contactedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `ConsentSupportRequest_status_createdAt_idx` (`status`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
