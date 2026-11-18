# Security settings for deployment

The application code handles authentication, access control, rate limits, upload checks and
safe error messages. These settings on the server are also needed for it to be secure.

## Backend environment (`backend/.env` on the server)

| Setting | What to set |
| --- | --- |
| `NODE_ENV` | `production`. Turns on HSTS and keeps password-reset links out of API responses. |
| `AUTH_TOKEN_SECRET` | A long random value, 48+ characters. Changing it signs every staff member out. |
| `FRONTEND_BASE_URL` | The public site address, e.g. `https://df.example.org`. Only this origin may call the API from a browser. |
| `TRUST_PROXY` | Leave unset if the reverse proxy is on the same machine or a private network. If it is on a public address, set the number of proxies in front of the API (usually `1`). This keeps rate limits tied to the real client address. |
| `BOOTSTRAP_ADMIN_TOKEN` | Only while creating the very first admin; a random value of 24+ characters sent as the `X-Bootstrap-Token` header. Remove it afterwards. |

## Web server / reverse proxy (nginx or similar)

- Serve the site and API over HTTPS only, and redirect HTTP to HTTPS.
- Send these headers with the frontend pages (they can't be set from the page itself):
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
- Hide the server version (`server_tokens off;` in nginx).
- Limit upload bodies to about 25 MB (`client_max_body_size 25m;`).

## Document storage (MinIO)

- The bucket must be private: no public read and no public listing. ID and disability
  documents are stored there.
- Use storage credentials that can only read and write that one bucket.
- Keep the MinIO data volume on an encrypted disk, and include it in the backups.

## Database and secrets

- The database must not be reachable from the internet; allow only the API server.
- Never commit `.env` or `Accounts.txt` (both are in `.gitignore`).
- Rotate any password or key that has been shared in chat, email or documents.

## Protections built into the application

These are in the code; no setting is needed. Listed so testers and reviewers know what to expect.

- **Staff sign-in:** each address gets 8 tries per account and 40 tries in total every 15 minutes. Separately, an account is locked for 15 minutes after 10 failed tries from any mix of addresses, which stops a botnet guessing one password. Passwords are hashed with scrypt, and unknown emails take as long to check as known ones.
- **Staff sessions:** tokens are signed with HMAC-SHA256. A changed signature, a different algorithm or `alg: none` is refused. Changing a password, role or country, or deactivating the account, ends every session for that account.
- **Password reset links:** single use, even when the same link is sent several times at once. Only a hash of the link is stored.
- **Single sign-on:** an account already linked to one organisation identity cannot be claimed by another identity with the same email, and an unverified email is refused.
- **Committee screens:** these only create, change or reset committee logins. An admin, country admin or viewer account cannot be taken over by adding a committee member with that person's email. Deactivating a member also ends their sign-in.
- **One-time codes** (Check status, Continue my application, participant registration):
  - Each code allows 5 guesses. A guess is counted before it is checked, so sending guesses in parallel gets no extra tries.
  - A new code is allowed after 60 seconds, with at most 5 per hour and 10 per day per application.
- **Saved applications:** only the browser holding the draft's private token can change or delete the draft. Another device needs the emailed code. There is no public lookup of a draft by reference.
- **"Already applied" notices:** each address sees at most 10 per hour. This stops the notice being used to find out who has applied.
- **Public inputs:**
  - Application answers are limited in number, size and format before they are checked.
  - Uploads are identified by their content (PDF, JPG or PNG only), stored under random names in the private bucket, and downloaded as attachments.
- **Applicant status page:** shows statuses and dates only, never staff notes.
- **Access by country:** country admins, committee members and viewers see only their own country, and committee members see only the applications assigned to them.
- **Data API:** read-only keys. Only a hash of each key is stored, and each key is limited to one country, expires and can be revoked.

Rate limits are kept in memory per API instance. If several backend instances run behind a load balancer, each keeps its own counts.
