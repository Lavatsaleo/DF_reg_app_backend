-- Drafts: an edit token held by the device filling in the draft, and the ID number for duplicate checks.
ALTER TABLE `RegistrationDraft`
  ADD COLUMN `normalizedNationalId` VARCHAR(191) NULL,
  ADD COLUMN `editTokenHash` VARCHAR(191) NULL;

CREATE INDEX `RegistrationDraft_normalizedNationalId_idx` ON `RegistrationDraft`(`normalizedNationalId`);

-- A submitted draft no longer holds the mobile number, so the same person can start a new
-- application after the first one ends.
UPDATE `RegistrationDraft`
  SET `normalizedContactNumber` = NULL
  WHERE `status` <> 'INCOMPLETE';
