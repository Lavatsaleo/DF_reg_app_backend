-- One live application per person, and a reason (emailed to the applicant) when an application ends.
--
-- Before: email and phone were unique for ever, so a person who was rejected could never apply again.
-- After: every application keeps its normalised email and phone, and the "active" keys below hold them
-- only while the application is live. The unique indexes on the active keys stop a second live
-- application from the same email, phone or national ID; a rejection clears them.

ALTER TABLE `Applicant`
    DROP INDEX `Applicant_normalizedEmail_key`,
    DROP INDEX `Applicant_normalizedContactNumber_key`,
    ADD COLUMN `normalizedNationalId` VARCHAR(191) NULL,
    ADD COLUMN `activeEmailKey` VARCHAR(191) NULL,
    ADD COLUMN `activePhoneKey` VARCHAR(191) NULL,
    ADD COLUMN `activeNationalIdKey` VARCHAR(191) NULL,
    ADD COLUMN `rejectionReasonCode` VARCHAR(191) NULL,
    ADD COLUMN `rejectionReason` TEXT NULL,
    ADD COLUMN `rejectionEmailStatus` VARCHAR(191) NULL,
    ADD COLUMN `rejectionEmailSentAt` DATETIME(3) NULL,
    ADD COLUMN `rejectionEmailError` TEXT NULL;

CREATE INDEX `Applicant_normalizedEmail_idx` ON `Applicant`(`normalizedEmail`);
CREATE INDEX `Applicant_normalizedContactNumber_idx` ON `Applicant`(`normalizedContactNumber`);
CREATE INDEX `Applicant_normalizedNationalId_idx` ON `Applicant`(`normalizedNationalId`);

ALTER TABLE `CommitteeReview`
    ADD COLUMN `notSelectedReasonCode` VARCHAR(191) NULL,
    ADD COLUMN `applicantMessage` TEXT NULL;

-- National ID from the application answers: COUNTRY:ID with only letters and digits.
UPDATE `Applicant` a
JOIN (
    SELECT `applicantId`, MIN(`valueText`) AS `idNumber`
    FROM `RegistrationResponse`
    WHERE `questionCode` = 'NATIONAL_ID_NUMBER' AND `valueText` IS NOT NULL AND `valueText` <> ''
    GROUP BY `applicantId`
) n ON n.`applicantId` = a.`id`
SET a.`normalizedNationalId` = CONCAT(UPPER(TRIM(a.`country`)), ':', REGEXP_REPLACE(UPPER(n.`idNumber`), '[^A-Z0-9]', ''))
WHERE a.`country` IS NOT NULL;

-- Email and phone were unique until now, so copying them for live applications cannot clash.
UPDATE `Applicant`
SET `activeEmailKey` = `normalizedEmail`,
    `activePhoneKey` = `normalizedContactNumber`
WHERE `status` NOT IN ('INELIGIBLE', 'REJECTED_BY_REVIEW_COMMITTEE');

-- National IDs were never unique: if two live applications share one, the earliest keeps the key.
UPDATE `Applicant` a
JOIN (
    SELECT `id` FROM (
        SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `normalizedNationalId` ORDER BY `createdAt`, `id`) AS `rn`
        FROM `Applicant`
        WHERE `normalizedNationalId` IS NOT NULL
          AND `status` NOT IN ('INELIGIBLE', 'REJECTED_BY_REVIEW_COMMITTEE')
    ) ranked
    WHERE ranked.`rn` = 1
) keep ON keep.`id` = a.`id`
SET a.`activeNationalIdKey` = a.`normalizedNationalId`;

CREATE UNIQUE INDEX `Applicant_activeEmailKey_key` ON `Applicant`(`activeEmailKey`);
CREATE UNIQUE INDEX `Applicant_activePhoneKey_key` ON `Applicant`(`activePhoneKey`);
CREATE UNIQUE INDEX `Applicant_activeNationalIdKey_key` ON `Applicant`(`activeNationalIdKey`);
