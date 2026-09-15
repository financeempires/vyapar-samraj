# Vyapar Samraj — Spring Boot Backend

## Architecture

```
Browser (Next.js localhost:3000)
         ↓ /api/* (relative URL)
Next.js  (next.config.ts rewrites)
         ↓ http://localhost:8080/api/*
Spring Boot Backend (localhost:8080)
         ↓ HikariCP / JPA
Neon PostgreSQL
```

The frontend never changes its API URLs. Next.js transparently proxies all `/api/*` calls to the Spring Boot backend via `rewrites()` in `next.config.ts`.

---

## Tech Stack

| Component | Version |
|---|---|
| **Java** | 17 LTS (installed) — upgrading to 21 possible once JDK 21 is installed |
| **Spring Boot** | 3.5.3 |
| **Spring Security** | 6.x (bundled) |
| **Spring Data JPA** | 3.x / Hibernate 6 |
| **JWT** | jjwt 0.12.6 (HS256) |
| **Rate Limiting** | Bucket4j 8.10.1 (in-memory, no Redis) |
| **Database** | Neon PostgreSQL (existing) |
| **Migrations** | Flyway 10.x (baseline-on-migrate — safe for existing DB) |
| **Monitoring** | Spring Actuator + Micrometer Prometheus |
| **Build** | Maven 3.x |

---

## Prerequisites

1. **Java 17** (already installed — `java -version`)
2. **Maven 3.8+** (`mvn -version`)
3. Neon PostgreSQL database (existing — same as frontend)

---

## Setup

### 1. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your actual Neon credentials
```

The `.env` already contains the correct values from the frontend `.env.local`.

**Required variables:**

| Variable | Description |
|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://host/db?sslmode=require` |
| `SPRING_DATASOURCE_USERNAME` | Neon username |
| `SPRING_DATASOURCE_PASSWORD` | Neon password |
| `JWT_SECRET` | **Must match** `JWT_SECRET` in frontend `.env.local` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` (dev) |

> The `JWT_SECRET` must be identical in both frontend and backend so that:
> - The Next.js middleware can still verify JWT tokens (for page route protection)
> - The Spring Boot backend issues tokens the middleware can read

### 2. Convert the Neon URL to JDBC format

```
Neon URL:  postgresql://user:pass@host/db?sslmode=require
JDBC URL:  jdbc:postgresql://host/db?sslmode=require
```

### 3. Start the backend

```bash
cd backend

# Pass env vars inline (PowerShell)
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://..."
$env:SPRING_DATASOURCE_USERNAME="neondb_owner"
$env:SPRING_DATASOURCE_PASSWORD="your_password"
$env:JWT_SECRET="super_secret_vyapar_samraj_key_2026_safe_auth_token_string"
$env:CORS_ALLOWED_ORIGINS="http://localhost:3000"

mvn spring-boot:run
```

Backend starts on **http://localhost:8080**

### 4. Start the frontend

```bash
# In the vyapar-samraj/ directory
npm run dev
```

Frontend starts on **http://localhost:3000**

Open `http://localhost:3000/login` — all API calls are automatically proxied to Spring Boot.

---

## Running Tests

```bash
cd backend
mvn test                  # Unit + integration tests (H2 in-memory, no Neon needed)
mvn clean verify          # Full lifecycle including compile + test
```

**Result: 8 tests, 0 failures, 0 errors**

---

## API Endpoints

All endpoints match the existing frontend contract **exactly**.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/super-admin/login` | Public | Login |
| POST | `/api/auth/super-admin/logout` | Public | Logout |
| GET | `/api/auth/signout` | Public | Legacy signout |
| GET | `/api/super-admin/dashboard` | SUPER_ADMIN | KPI stats |
| GET | `/api/users` | Any auth | List users |
| POST | `/api/users` | SUPER_ADMIN | Create user |
| GET | `/api/users/{id}` | Any auth | Get user |
| PATCH | `/api/users/{id}` | Any auth | Update user |
| DELETE | `/api/users/{id}` | SUPER_ADMIN | Delete user |
| GET | `/api/plans` | Any auth | List plans |
| POST | `/api/plans` | SUPER_ADMIN | Create plan |
| GET | `/api/plans/{id}` | Any auth | Get plan |
| PATCH | `/api/plans/{id}` | SUPER_ADMIN | Update plan |
| DELETE | `/api/plans/{id}` | SUPER_ADMIN | Delete plan |
| GET | `/api/subscriptions` | Any auth | List subscriptions |
| POST | `/api/subscriptions` | SUPER_ADMIN | Create subscription |
| GET | `/api/subscriptions/{id}` | Any auth | Get subscription |
| PATCH | `/api/subscriptions/{id}` | SUPER_ADMIN | Update subscription |
| GET | `/api/transactions` | Any auth | List transactions |
| POST | `/api/transactions` | SUPER_ADMIN/USER | Create transaction |
| GET | `/api/transactions/{id}` | Any auth | Get transaction |
| PATCH | `/api/transactions/{id}` | SUPER_ADMIN/USER | Update transaction |
| DELETE | `/api/transactions/{id}` | SUPER_ADMIN | Delete transaction |
| GET | `/api/sub-users` | SUPER_ADMIN/USER | List sub-users |
| POST | `/api/sub-users` | SUPER_ADMIN/USER | Create sub-user |
| GET | `/api/sub-users/{id}` | SUPER_ADMIN/USER | Get sub-user |
| PATCH | `/api/sub-users/{id}` | SUPER_ADMIN/USER | Update sub-user |
| DELETE | `/api/sub-users/{id}` | SUPER_ADMIN/USER | Delete sub-user |
| GET | `/api/notifications` | Any auth | List notifications |
| PATCH | `/api/notifications/{id}/read` | Any auth | Mark read |

**Actuator** (safe endpoints only):
- `GET /actuator/health`
- `GET /actuator/info`
- `GET /actuator/metrics` (SUPER_ADMIN only)
- `GET /actuator/prometheus` (SUPER_ADMIN only)

---

## Security

| Protection | Implementation |
|---|---|
| Password hashing | BCryptPasswordEncoder (matches existing `$2a$` Neon hashes) |
| Session | JWT HS256 in `sa_session` HttpOnly cookie |
| Cookie flags | `HttpOnly; SameSite=Lax; Secure` (in production) |
| Rate limiting | Bucket4j — 5 attempts / 15 min / IP (no Redis) |
| CORS | Restricted to `CORS_ALLOWED_ORIGINS` — never `*` |
| CSRF | Disabled for REST API (CORS is the protection mechanism) |
| Authorization | Role-checked in every service method |
| Data isolation | USER/SUB_USER queries scoped to `user_id = session.id` |
| Audit logging | Async `ActivityLog` writes for every mutation |
| Error responses | Generic messages — no stack traces, no DB errors |

---

## Flyway Strategy

- `spring.flyway.baseline-on-migrate=true` — marks existing database as V1 without running the migration
- `spring.flyway.baseline-version=1` — existing schema is baseline
- `ddl-auto=validate` — Hibernate verifies schema but never modifies it
- Future migrations go in `V2__...sql`, `V3__...sql`, etc.

---

## Remaining Work

1. **User/SUB_USER login** — currently only SUPER_ADMIN can login. Add `/api/auth/login` for USER/SUB_USER roles when ready.
2. **Email provider** — connect Resend/SendGrid/SES in `EmailService.java`.
3. **Production HTTPS** — set `SPRING_PROFILES_ACTIVE=prod` to enable `Secure` cookie flag.
4. **Remove legacy Next.js API routes** — after verifying all frontend calls work against Spring Boot, remove `src/app/api/` route handlers (they are now superseded by the proxy).
5. **JDK 21** — upgrade when available for virtual threads and better performance.
