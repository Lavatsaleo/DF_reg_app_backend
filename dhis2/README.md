# Digital Futures DHIS2 tracker program

Generated from the registration portal's question definitions by `npm run dhis2:metadata`
(`src/scripts/generateDhis2TrackerMetadata.js`). Do not edit these files by hand; change the questions or the
script and regenerate.

| File | Purpose |
|---|---|
| `digital-futures-tracker-metadata.json` | The tracker program, ready for DHIS2 metadata import |
| `digital-futures-data-dictionary.csv` | Every field with its stage, question, type, options and show/hide condition, for review |
| `digital-futures-dhis2-mapping.json` | Portal question code → DHIS2 UID and option code, used by the sync service |

UIDs are derived from the question codes, so regenerating gives the same UIDs and a re-import updates the
existing program instead of creating a second one.

## What is in the program

- **Tracked entity type:** Digital Futures participant.
- **Registration form (attributes):** application reference (unique), participant code (unique), application
  status, name, sex, date of birth, ID, phone, email, preferred contact method, country and location.
- **Stages**
  1. **Application** (once): all three pathway forms merged, consent and assistance details, and the
     portal's eligibility screening result. Questions a pathway does not ask are hidden by program rules.
  2. **Basic IT skills test** (once): score, percentage, pass/fail, pass mark, time taken, test version.
  3. **Selection committee review** (repeatable): one event per committee decision, with comments.
  4. **Participant registration & baseline survey** (once): modules 1–5 and the participant consent.
- **Program rules** reproduce the portal's show/hide logic (for example, county only for Kenya, disability
  type only when the applicant reports a disability).
- **Multi-select questions** become one yes-only data element per option, so each choice (for example each
  disability type) can be counted in DHIS2 analytics on any DHIS2 version.
- **Signatures** are image data elements; uploaded documents are file data elements.

## Importing

1. Open **Import/Export → Metadata import** in DHIS2. The file passes a validate-only import with no errors
   on DHIS2 2.40, 2.41 and 2.42 (October 2026).
2. Choose `digital-futures-tracker-metadata.json`, set **Import mode: Validate** (dry run) and run it. Fix
   anything it reports, then import again with **Import mode: Commit**.
3. Assign the program to the country organisation units (Ghana, Kenya, Nigeria, Zambia) in the
   **Maintenance** app; the file assigns none because organisation unit UIDs differ per DHIS2 instance.
4. Set sharing: metadata and data access for the programme team's user groups. The program is
   `PROTECTED`, so users outside an organisation unit's search scope must break the glass to open records.
5. Open the program in the **Capture** app and check the registration form and each stage.

## Not included yet

Verification, onboarding and the training lifecycle stages are not built in the portal yet, so they are not in
this program. Data moves into DHIS2 once the portal's sync service is built; until then this program is the
agreed structure to sync into.
