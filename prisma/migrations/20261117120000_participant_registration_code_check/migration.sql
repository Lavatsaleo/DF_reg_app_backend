-- Participant registration links now also need a code emailed to the participant.
ALTER TABLE `ParticipantRegistrationInvitation`
  ADD COLUMN `accessSessionHash` VARCHAR(191) NULL,
  ADD COLUMN `accessSessionExpiresAt` DATETIME(3) NULL;
