-- Read-only API keys for pulling data into R. Only the key hash is stored.
CREATE TABLE `ApiAccessKey` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `keyPrefix` VARCHAR(191) NOT NULL,
    `keyHash` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NULL,
    `includePersonalData` BOOLEAN NOT NULL DEFAULT false,
    `createdByUserId` VARCHAR(191) NULL,
    `createdByName` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `lastUsedIp` VARCHAR(191) NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedByName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ApiAccessKey_keyHash_key`(`keyHash`),
    INDEX `ApiAccessKey_revokedAt_idx`(`revokedAt`),
    INDEX `ApiAccessKey_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
