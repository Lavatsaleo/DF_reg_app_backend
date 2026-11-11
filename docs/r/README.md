# Pulling Digital Futures data into R

The backend has a read-only data API for analysis in R / RStudio. Access uses an **API key** that a super admin creates in the Application dashboard under **API access for R**.

## Keys

- Keys start with `dfk_`. The full key is shown **once**, when it is created. Only a hash is stored.
- Each key has a name (who or what uses it), an expiry (30, 90, 180 or 365 days), a country (or all countries) and a personal-data setting.
- **De-identified (default):** no names, phone numbers, emails, dates of birth, next of kin, application references or free-text answers. Applicants are identified by `id` and `participantCode`.
- **Personal data:** adds those fields. Only for people who need to contact participants, and only with a data-protection reason.
- Revoking a key stops it working straight away. Revoke keys when someone leaves or a key may have been shared.

## Endpoints

All are `GET` with `Authorization: Bearer dfk_...`.

| Path | Rows |
| --- | --- |
| `/api/data/v1` | What the key can see, and the list of datasets |
| `/api/data/v1/applicants` | One per application |
| `/api/data/v1/status-history` | One per status change |
| `/api/data/v1/skills-tests` | One per basic skills test attempt |
| `/api/data/v1/committee-reviews` | One per committee decision (reviewer id only) |

Query parameters: `page` (from 1), `pageSize` (up to 5000, default 1000), `country`, `updatedSince` (ISO date).
Responses: `{ dataset, page, pageSize, total, hasMore, country, includesPersonalData, data: [...] }`.

Limit: 300 requests per 15 minutes per address.

## RStudio

1. `install.packages(c("httr2", "jsonlite"))`
2. Run `usethis::edit_r_environ()` and add:

   ```
   DF_API_URL=https://your-digital-futures-site.org
   DF_API_KEY=dfk_paste_your_key_here
   ```

   Restart R.
3. Use the helper script:

   ```r
   source("digital_futures_data.R")
   df_whoami()
   applicants <- df_get("applicants")
   tests      <- df_get("skills-tests")
   both <- merge(applicants, tests, by.x = "id", by.y = "applicantId", all.x = TRUE)
   ```

Never put the key in a script, a shared project, Git or a chat.
