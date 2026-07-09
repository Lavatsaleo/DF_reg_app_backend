-- Add country scoping for the selection committee access model.
-- Existing ADMIN accounts remain super admins. New COUNTRY_ADMIN accounts are scoped by country.

ALTER TABLE `StaffUser`
  MODIFY `role` ENUM('ADMIN', 'COUNTRY_ADMIN', 'COMMITTEE_CHAIRPERSON', 'COMMITTEE_MEMBER', 'VIEWER') NOT NULL DEFAULT 'COMMITTEE_MEMBER',
  ADD COLUMN `country` VARCHAR(191) NULL;

ALTER TABLE `CommitteeMember`
  ADD COLUMN `country` VARCHAR(191) NULL;

CREATE INDEX `StaffUser_country_idx` ON `StaffUser`(`country`);
CREATE INDEX `CommitteeMember_country_idx` ON `CommitteeMember`(`country`);
