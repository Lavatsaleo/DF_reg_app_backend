-- CreateTable
CREATE TABLE `Applicant` (
    `id` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `contactNumber` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `alternativeContactNumber` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `town` VARCHAR(191) NULL,
    `county` VARCHAR(191) NULL,
    `subCounty` VARCHAR(191) NULL,
    `yearOfBirth` INTEGER NULL,
    `approximateAge` INTEGER NULL,
    `sex` VARCHAR(191) NULL,
    `householdSize` INTEGER NULL,
    `educationLevel` VARCHAR(191) NULL,
    `courseStudied` VARCHAR(191) NULL,
    `currentEducationStatus` VARCHAR(191) NULL,
    `previousSightsaversTraining` BOOLEAN NULL,
    `hasDisability` BOOLEAN NOT NULL DEFAULT false,
    `disabilityType` VARCHAR(191) NULL,
    `otherDisabilityType` VARCHAR(191) NULL,
    `accessibilityNeeds` TEXT NULL,
    `canParticipateOnline` BOOLEAN NULL,
    `hasDeviceAccess` BOOLEAN NULL,
    `heardAboutProject` VARCHAR(191) NULL,
    `motivation` TEXT NULL,
    `employmentStatus` VARCHAR(191) NULL,
    `jobSearchActions` TEXT NULL,
    `monthlyIncomeRange` VARCHAR(191) NULL,
    `dignifiedWorkResponse` TEXT NULL,
    `careerAspirations` TEXT NULL,
    `currentBusinessDetails` TEXT NULL,
    `preferredSector` VARCHAR(191) NULL,
    `registrationMode` ENUM('PHYSICAL', 'VIRTUAL', 'BOTH', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `formName` VARCHAR(191) NULL DEFAULT 'Registration Form - phy & virt',
    `formVersion` VARCHAR(191) NULL DEFAULT '1.0',
    `isEligible` BOOLEAN NOT NULL DEFAULT false,
    `eligibilityReason` TEXT NULL,
    `status` ENUM('SUBMITTED', 'INELIGIBLE', 'ELIGIBLE_PENDING_DHIS2_SYNC', 'SYNCED_TO_DHIS2_PENDING_REVIEW', 'UNDER_REVIEW', 'APPROVED_FOR_ENROLLMENT', 'REJECTED_BY_REVIEW_COMMITTEE', 'ENROLLED_IN_DHIS2_PROGRAM', 'SYNC_FAILED') NOT NULL DEFAULT 'SUBMITTED',
    `dhis2TrackedEntityId` VARCHAR(191) NULL,
    `dhis2OrgUnitId` VARCHAR(191) NULL,
    `dhis2ProgramId` VARCHAR(191) NULL,
    `dhis2EnrollmentId` VARCHAR(191) NULL,
    `reviewDecision` ENUM('APPROVED', 'REJECTED', 'NEEDS_MORE_INFORMATION') NULL,
    `reviewComments` TEXT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Applicant_status_idx`(`status`),
    INDEX `Applicant_country_idx`(`country`),
    INDEX `Applicant_county_idx`(`county`),
    INDEX `Applicant_subCounty_idx`(`subCounty`),
    INDEX `Applicant_isEligible_idx`(`isEligible`),
    INDEX `Applicant_dhis2TrackedEntityId_idx`(`dhis2TrackedEntityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RegistrationResponse` (
    `id` VARCHAR(191) NOT NULL,
    `applicantId` VARCHAR(191) NOT NULL,
    `questionCode` VARCHAR(191) NOT NULL,
    `questionNumber` INTEGER NULL,
    `questionText` TEXT NOT NULL,
    `section` VARCHAR(191) NULL,
    `responseType` ENUM('TEXT', 'LONG_TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SINGLE_SELECT', 'MULTI_SELECT', 'PHONE', 'EMAIL', 'FILE') NOT NULL DEFAULT 'TEXT',
    `valueText` TEXT NULL,
    `valueNumber` DOUBLE NULL,
    `valueBoolean` BOOLEAN NULL,
    `valueDate` DATETIME(3) NULL,
    `valueJson` JSON NULL,
    `isEligibilityQuestion` BOOLEAN NOT NULL DEFAULT false,
    `isPassing` BOOLEAN NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RegistrationResponse_applicantId_idx`(`applicantId`),
    INDEX `RegistrationResponse_questionCode_idx`(`questionCode`),
    INDEX `RegistrationResponse_isEligibilityQuestion_idx`(`isEligibilityQuestion`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApplicantDocument` (
    `id` VARCHAR(191) NOT NULL,
    `applicantId` VARCHAR(191) NOT NULL,
    `documentType` ENUM('NATIONAL_ID', 'PASSPORT', 'BIRTH_CERTIFICATE', 'MEDICAL_DOCUMENT', 'REFERRAL_LETTER', 'CONSENT_FORM', 'DISABILITY_DOCUMENT', 'EDUCATION_CERTIFICATE', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `originalName` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `storageBucket` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `storageUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ApplicantDocument_applicantId_idx`(`applicantId`),
    INDEX `ApplicantDocument_documentType_idx`(`documentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Dhis2SyncLog` (
    `id` VARCHAR(191) NOT NULL,
    `applicantId` VARCHAR(191) NOT NULL,
    `action` ENUM('CREATE_TRACKED_ENTITY', 'ENROLL_IN_PROGRAM', 'UPDATE_TRACKED_ENTITY') NOT NULL,
    `status` ENUM('PENDING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `requestPayload` JSON NULL,
    `responsePayload` JSON NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Dhis2SyncLog_applicantId_idx`(`applicantId`),
    INDEX `Dhis2SyncLog_action_idx`(`action`),
    INDEX `Dhis2SyncLog_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RegistrationResponse` ADD CONSTRAINT `RegistrationResponse_applicantId_fkey` FOREIGN KEY (`applicantId`) REFERENCES `Applicant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicantDocument` ADD CONSTRAINT `ApplicantDocument_applicantId_fkey` FOREIGN KEY (`applicantId`) REFERENCES `Applicant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Dhis2SyncLog` ADD CONSTRAINT `Dhis2SyncLog_applicantId_fkey` FOREIGN KEY (`applicantId`) REFERENCES `Applicant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
