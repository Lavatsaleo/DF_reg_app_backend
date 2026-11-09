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
| `S3_SERVER_SIDE_ENCRYPTION` | Optional, e.g. `AES256`, to encrypt uploaded documents at rest. |

## Web server / reverse proxy (nginx or similar)

- Serve the site and API over HTTPS only, and redirect HTTP to HTTPS.
- Send these headers with the frontend pages (they can't be set from the page itself):
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
- Hide the server version (`server_tokens off;` in nginx).
- Limit upload bodies to about 25 MB (`client_max_body_size 25m;`).

## Document storage (S3 / MinIO)

- The bucket must be private: no public read and no public listing. ID and disability
  documents are stored there.
- Use storage credentials that can only read and write that one bucket.

## Database and secrets

- The database must not be reachable from the internet; allow only the API server.
- Never commit `.env` or `Accounts.txt` (both are in `.gitignore`).
- Rotate any password or key that has been shared in chat, email or documents.
