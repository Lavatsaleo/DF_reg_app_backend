-- Saved progress for the participant registration form (save and resume).
ALTER TABLE `ParticipantRegistrationInvitation`
  ADD COLUMN `draftData` JSON NULL,
  ADD COLUMN `draftDocuments` JSON NULL,
  ADD COLUMN `draftSavedAt` DATETIME(3) NULL;
