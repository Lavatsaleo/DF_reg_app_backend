-- AlterTable
ALTER TABLE `Applicant` ADD COLUMN `pathway` ENUM('PHYSICAL_ACADEMY', 'VIRTUAL_ACADEMY', 'DIGITAL_ENTREPRENEURSHIP', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN';

-- CreateIndex
CREATE INDEX `Applicant_pathway_idx` ON `Applicant`(`pathway`);

-- CreateIndex
CREATE INDEX `Applicant_registrationMode_idx` ON `Applicant`(`registrationMode`);
