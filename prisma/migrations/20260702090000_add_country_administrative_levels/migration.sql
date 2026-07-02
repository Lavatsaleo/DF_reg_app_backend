ALTER TABLE `Applicant`
  ADD COLUMN `state` VARCHAR(191) NULL,
  ADD COLUMN `region` VARCHAR(191) NULL,
  ADD COLUMN `district` VARCHAR(191) NULL;

CREATE INDEX `Applicant_state_idx` ON `Applicant`(`state`);
CREATE INDEX `Applicant_region_idx` ON `Applicant`(`region`);
CREATE INDEX `Applicant_district_idx` ON `Applicant`(`district`);
