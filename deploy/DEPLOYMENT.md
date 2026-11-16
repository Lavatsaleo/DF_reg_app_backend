# Digital Futures: deployment guide

The Digital Futures registration portal runs as two Docker images plus a MySQL database and
S3-compatible document storage. This guide is for whoever hosts the Test and Production environments.

## 1. What runs

| Container | Image | Listens on | Role |
| --- | --- | --- | --- |
| `web` | `19631/df-frontend` | 8080 (HTTP) | nginx: serves the React site and forwards `/api/*` to `api` |
| `api` | `19631/df-backend` | 5000 (HTTP, internal only) | Node.js API; applies database migrations when it starts |
| `mysql` | `mysql:8.4` (optional) | 3306 (internal only) | Database, unless a managed MySQL 8 is used |
| `minio` | `minio/minio` (optional) | 9000 (internal only) | Document storage, unless another S3-compatible service is used |

```
 Internet ──HTTPS──> [ load balancer / reverse proxy with the certificate ]
                                   │ HTTP
                                   ▼
                          web :8080 (nginx)
                           ├─ /           -> static site (single-page app)
                           ├─ /healthz    -> health check
                           └─ /api/*      -> api :5000 ──> MySQL 3306
                                                     └──> S3 / MinIO 9000
                                                     └──> SMTP (outbound email)
```

Only `web` is exposed. The API, database and storage must not be reachable from the internet.

## 2. Images and access

Images are built by GitHub Actions in the two repositories and published as **public** images on
Docker Hub, under the account `19631`:

| Image | Built from |
| --- | --- |
| [`19631/df-backend`](https://hub.docker.com/r/19631/df-backend) | github.com/Lavatsaleo/DF_reg_app_backend |
| [`19631/df-frontend`](https://hub.docker.com/r/19631/df-frontend) | github.com/Lavatsaleo/DF_reg_app_frontend |

Tags:

| Tag | When it is published | Use for |
| --- | --- | --- |
| `test` | every push to the `Test` branch | Test environment |
| `1.2.3` and `prod` | a release tag `v1.2.3` | Production (pin the version number) |
| `sha-<commit>` | every build | pinning or rolling back exactly |

No sign-in is needed to pull:

```
docker pull 19631/df-backend:test
docker pull 19631/df-frontend:test
```

Docker Hub limits anonymous pulls per IP address. If a host pulls often (for example, autoscaling),
sign in with a read-only Docker Hub token to raise the limit.

The images are public and contain no secrets: every password, key and address is passed as an
environment variable at run time.

## 3. Configuration

### API container (`df-backend`)

Every setting is listed and explained in [`.env.example`](.env.example). The essentials:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | `mysql://user:password@host:3306/database`. Add `?sslaccept=strict` for Azure Database for MySQL. |
| `AUTH_TOKEN_SECRET` | yes | 48+ random characters, different per environment. |
| `FRONTEND_BASE_URL` | yes | Public HTTPS address of the site, e.g. `https://digitalfutures.duckdns.org`. Used in email links and as the only allowed browser origin. |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE` | yes | Private bucket for applicant documents. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL` | yes | Invitations, one-time codes, password resets and rejection reasons are all sent by email. |
| `NODE_ENV` | set by the image | `production`. |
| `RUN_MIGRATIONS` | no (default `true`) | Applies database migrations on start. With more than one API replica, set `false` and run migrations once per release (below). |
| `TRUST_PROXY` | no | Leave empty when the proxies in front are on private addresses. If the HTTPS proxy has a public address, set the number of proxies in front of the API. |

The API needs outbound access to the database, the storage endpoint and the SMTP server.

### Web container (`df-frontend`)

| Variable | Default | Notes |
| --- | --- | --- |
| `BACKEND_UPSTREAM` | `backend:5000` | Host and port of the API container (the compose file sets `api:5000`). |
| `CLIENT_MAX_BODY_SIZE` | `25m` | Largest request accepted (document uploads). |

## 4. Web server and routing

The `web` container already contains the nginx configuration
([`frontend/nginx/default.conf.template`](https://github.com/Lavatsaleo/DF_reg_app_frontend/blob/Test/nginx/default.conf.template)):

- `/api/*` is proxied to the API with `Host`, `X-Forwarded-For` and `X-Forwarded-Proto`. The site and API share one address, so there is no cross-origin traffic.
- Every other path returns `index.html` (single-page app routes such as `/apply/physical-academy`, `/staff/committee`, `/reset-password/<token>`, `/participant-registration/<token>`).
- `/assets/*` is cached for a year (file names change with every build); pages are not cached.
- Security headers: HSTS, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`. The page's Content Security Policy is built into `index.html`.
- `/healthz` returns `200 ok` for health probes.

What the hosting layer in front of `web` needs to do:

1. End HTTPS with a valid certificate for each address, and redirect HTTP to HTTPS.
2. Forward all paths to `web:8080`, keeping the `Host` header and setting `X-Forwarded-For` and `X-Forwarded-Proto: https`.
3. Allow request bodies of at least 25 MB and a 120-second timeout (document uploads).
4. Use `GET /healthz` on port 8080 as the health probe.

No other routing is needed: one address serves both the site and `/api`.

## 5. First deployment (Docker Compose)

```
cd deploy
cp .env.example .env               # fill in every value
docker compose --profile bundled up -d    # with the bundled MySQL and MinIO
# or: docker compose up -d                # with managed MySQL and S3 storage set in .env
docker compose logs -f api         # wait for "running on port 5000"
```

Then, once per environment:

1. **Load the skills test questions:**
   `docker compose exec api npm run seed:basic-skills`
2. **Create the first super admin.** Set `BOOTSTRAP_ADMIN_TOKEN` in `.env` to a random value of 24+ characters, run `docker compose up -d api`, then:
   ```
   curl -X POST https://<site>/api/auth/bootstrap-admin \
     -H "Content-Type: application/json" -H "X-Bootstrap-Token: <token>" \
     -d '{"fullName":"...","email":"...","password":"<12+ characters, mixed case, number, symbol>"}'
   ```
   This works only while there are no staff accounts. Afterwards remove `BOOTSTRAP_ADMIN_TOKEN` and run `docker compose up -d api` again. Further staff are added from the app.
3. **Check:** open the site, sign in at `/staff/committee`, and confirm an email arrives (use "Forgot your password?").

## 6. Updating and rolling back

```
docker compose pull && docker compose up -d     # migrations run as the API starts
```

To roll back, set `IMAGE_TAG` to the previous version or `sha-<commit>` and run `docker compose up -d`.
Migrations only add to the database, so a rollback of the code is safe; restoring data needs a backup.

With several API replicas (`RUN_MIGRATIONS=false`), run migrations once before starting the new version:
`docker compose run --rm api npx prisma migrate deploy`

## 7. Backups and data protection

- Back up the MySQL database daily (managed MySQL backups, or `mysqldump` from the `mysql` container) and the document bucket (the `minio_data` volume or the storage service's own backup). Keep backups encrypted and test a restore.
- The bucket holds ID and disability documents: it must stay private, with credentials limited to that one bucket.
- The database must accept connections only from the API.
- Keep `.env` out of version control and rotate any secret that has been shared in chat or email.

## 8. Environments

| | Test | Production |
| --- | --- | --- |
| Address | `https://digitalfutures.duckdns.org` (current) | to be confirmed by Sightsavers |
| Image tag | `test` | release version, e.g. `1.0.0` |
| Data | test data only | live applicant data |
| Email | real SMTP, test recipients | real SMTP |

Each environment needs its own database, bucket, secrets and `.env`.
