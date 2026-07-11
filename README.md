# Paylink Generator

Aplicación Next.js para crear links de pago con MONEI, guardar toda la operativa en SQLite y disparar correos cuando el pago se confirma.

## Qué hace

- Crea pagos hosted de MONEI a partir de título, descripción y precio.
- Guarda configuración, links, estados y eventos en SQLite (data/paylink.sqlite).
- Usa el webhook de MONEI como fuente de verdad para marcar si un pago está cobrado o no.
- Envía un email al destinatario adicional del link y a un email estándar configurable.
- Permite editar la configuración desde la propia interfaz.

## Puesta en marcha

1. Instala dependencias:

bash
npm install


2. Crea tu entorno:

bash
cp .env.example .env.local


3. Completa al menos:

- APP_BASE_URL
- MONEI_API_KEY
- DEFAULT_NOTIFICATION_EMAIL
- SMTP_HOST
- SMTP_PORT
- SMTP_FROM

4. Arranca en local:

bash
npm run start


Ese comando levanta next dev bajo nodemon en http://localhost:3000.

Si solo quieres arrancar Next sin túnel:

bash
npm run dev


## Flujo MONEI implementado

- Se crea un payment vía POST /payments.
- La app usa payment.nextAction.redirectUrl como link de pago compartible.
- El webhook llega a /api/monei/webhook.
- La firma MONEI-Signature se verifica con HMAC SHA-256 usando la API key.
- El estado definitivo se persiste en SQLite y, si pasa a SUCCEEDED, se intenta enviar el correo.

## Variables de entorno

Los valores del .env se usan como semilla inicial en la tabla settings. Después puedes cambiarlos desde la UI.

- APP_NAME
- MERCHANT_DISPLAY_NAME
- APP_BASE_URL
- DEFAULT_CURRENCY
- DEFAULT_ALLOWED_PAYMENT_METHODS
- MONEI_API_KEY
- MONEI_ACCOUNT_ID
- MONEI_CALLBACK_PATH
- MONEI_COMPLETE_URL
- MONEI_FAIL_URL
- MONEI_CANCEL_URL
- DEFAULT_NOTIFICATION_EMAIL
- SMTP_HOST
- SMTP_PORT
- SMTP_SECURE
- SMTP_USER
- SMTP_PASS
- SMTP_FROM
- SMTP_FROM_NAME
- EMAIL_SUBJECT_TEMPLATE

## Notas

- Si Base URL no está bien configurada, MONEI no podrá llamar al webhook.
- Si el SMTP está incompleto, el pago se registrará igualmente pero el email no saldrá.
- Se asume que “Microsoft SQL Lite” en realidad era SQLite, porque es la base embebida estándar en este escenario. pasalo a ingles entero 

Aquí tienes la traducción completa:

Paylink Generator
A Next.js application for creating MONEI payment links, storing all operations in SQLite, and sending emails when a payment is confirmed.

What It Does
Creates MONEI hosted payments from a title, description, and price.

Stores settings, payment links, statuses, and events in SQLite (data/paylink.sqlite).

Uses the MONEI webhook as the source of truth to determine whether a payment has been successfully completed.

Sends an email to the additional recipient specified for the payment link and to a configurable default email address.

Allows settings to be edited directly from the user interface.

Getting Started
Install the dependencies:

npm install
Create your environment file:

cp .env.example .env.local
Configure at least the following variables:

APP_BASE_URL

MONEI_API_KEY

DEFAULT_NOTIFICATION_EMAIL

SMTP_HOST

SMTP_PORT

SMTP_FROM

Start the application locally:

npm run start
This command starts next dev through nodemon at http://localhost:3000.

To start Next.js without the tunnel:

npm run dev
Implemented MONEI Flow
A payment is created through POST /payments.

The application uses payment.nextAction.redirectUrl as the shareable payment link.

The webhook is received at /api/monei/webhook.

The MONEI-Signature header is verified using HMAC SHA-256 with the API key.

The final payment status is stored in SQLite and, when it changes to SUCCEEDED, the application attempts to send the notification email.

Environment Variables
The values from the .env file are used as the initial seed data for the settings table. They can later be changed from the user interface.

APP_NAME

MERCHANT_DISPLAY_NAME

APP_BASE_URL

DEFAULT_CURRENCY

DEFAULT_ALLOWED_PAYMENT_METHODS

MONEI_API_KEY

MONEI_ACCOUNT_ID

MONEI_CALLBACK_PATH

MONEI_COMPLETE_URL

MONEI_FAIL_URL

MONEI_CANCEL_URL

DEFAULT_NOTIFICATION_EMAIL

SMTP_HOST

SMTP_PORT

SMTP_SECURE

SMTP_USER

SMTP_PASS

SMTP_FROM

SMTP_FROM_NAME

EMAIL_SUBJECT_TEMPLATE

Notes
If the Base URL is not configured correctly, MONEI will not be able to call the webhook.

If the SMTP configuration is incomplete, the payment will still be recorded, but the email will not be sent.

It is assumed that “Microsoft SQL Lite” actually referred to SQLite, as it is the standard embedded database for this type of application.

He usado un inglés técnico natural, adecuado para un README.md.



Pegado text(44).txt
Documento
puedes darme este entero en ingles tambien? 

Ha pensado durante 27s

Analizado
from pathlib import Path

translated = r"""# Regismatic

A time tracking application for Spain with two separate projects in the same repository:

- `frontend/`: Ionic Angular responsive web application with a mobile foundation using Capacitor.
- `backend/`: Express API with Prisma and PostgreSQL.

The database is PostgreSQL (SQL), not SQLite.

## Quick Overview

- Monorepo with separate frontend and backend projects.
- Ionic Angular frontend prepared for responsive web and mobile use with Capacitor.
- Express backend with Prisma and PostgreSQL.
- Roles:
  - `EMPLOYEE`
  - `ADMIN`
  - `SUPERADMIN`
- Supports multiple administrators and separate teams.
- Includes in-app and push notifications.
- Includes Stripe plan billing for administrators.
- If an `ADMIN` has neither an active subscription nor a manual limit, neither the administrator nor their team can clock in or out.
- When an administrator account has neither a subscription nor a manual limit, the application warns that its data may be deleted after six months.
- Includes basic demo data and optional large demo fixtures.

## Structure

- `frontend`
- `backend`
- `docker-compose.yml`: local environment.
- `docker-compose.prod.yml`: production environment with TLS using Caddy.
- `docs/deploy-production.md`: deployment to a self-hosted server with Docker Compose.
- `docs/deploy-railway.md`: full Railway deployment.
- `docs/deploy-railway-paso-a-paso.md`: detailed step-by-step Railway guide for users with no previous experience.
- `infra/caddy/Caddyfile`
- `scripts`: database backup and restore scripts.

## Features

- JWT login with `SUPERADMIN`, `ADMIN`, and `EMPLOYEE` roles.
- Public administrator registration from the application itself at `/register-admin`.
- Plan-based billing for administrators:
  - Seven-day trial for three users.
  - Pack 10 with monthly and yearly pricing defined in Stripe.
  - Pack 20: EUR 29/month.
  - Pack 50: EUR 59/month.
  - Pack 100: EUR 99/month.
  - Monthly and yearly plans in Stripe.
  - Stripe Checkout and Customer Portal.
  - A `SUPERADMIN` can set manual user limits for each `ADMIN`.
  - A manual limit takes precedence over Stripe until it is removed.
- Public employee registration from the application itself at `/register-employee`.
- The first publicly registered administrator is automatically promoted to `SUPERADMIN`.
- New administrators start with a seven-day, three-user trial.
- The public trial uses the originating IP address to help prevent multiple trial accounts from the same source.
- Multi-administrator support: each administrator manages only their own workforce.
- Code-based team onboarding flow:
  - Each `ADMIN` has their own access code.
  - An employee can create a profile, enter the code, and submit a request to join the team.
  - The target `ADMIN` can approve or reject the request.
  - A `SUPERADMIN` can review everything, view administrator codes, and take action without depending on third-party approval.
- Time tracking:
  - Clock in.
  - Start and end breaks.
  - Clock out.
- Event traceability with an audit trail of changes, including who made each change and when.
- Optional geolocation for each event.
- Manual adjustments by administrators.
- Date-range reports and Excel export (`.xlsx`) with pivot-table-style summary sheets.
- Correction requests submitted by employees.
- Request review and direct record editing by administrators.
- Prioritized issue center for administrators, displayed at the top of the reports area.
- In-app notifications and Android/iOS push notifications using FCM.
- Per-user profile pictures, with a default avatar when no image is available.
- Scope-based user management:
  - `ADMIN`: can only create and manage their own employees.
  - `SUPERADMIN`: can view everything, create administrators, superadministrators, and assigned employees, and reassign employees between administrators.
- Optional large demo fixture dataset for visual and functional testing.
- Basic API hardening:
  - Configurable CORS.
  - Rate limiting.
  - Global payload sanitization.
  - Strict schemas.
  - Health checks.

## Functional Architecture

### `frontend/`

- Responsive web interface.
- Mobile support with Capacitor.
- Theme, language, notification, and role-based navigation management.

### `backend/`

- JWT authentication.
- Business rules for time tracking, issues, teams, and notifications.
- Prisma as the SQL access layer.

### PostgreSQL

- Stores users, time entries, requests, notifications, and push tokens.

### Caddy

- TLS reverse proxy in production.

## Roles and Permissions

### `EMPLOYEE`

- Tracks their own working day when their administrator has active billing or a manual limit.
- Views their records.
- Requests corrections.
- Can create their profile publicly.
- Can request to join a team using an administrator code.

### `ADMIN`

- Manages only their own team.
- Creates employees directly.
- Their employee limit depends on the active plan.
- If they have neither an active subscription nor a manual limit, they can only use the Dashboard and Billing sections until the account is brought back into good standing.
- Approves or rejects correction requests from their team.
- Approves or rejects requests to join their team.
- Can modify records belonging to their workforce.

### `SUPERADMIN`

- Has global visibility.
- Can create `ADMIN`, `SUPERADMIN`, and `EMPLOYEE` users.
- Can reassign employees between administrators.
- Can review any issue and any request to join a team.
- Can set or remove manual user limits for any `ADMIN`.
- Does not depend on third-party approval.
- Is not restricted by plans or Stripe.

## Main Flows

### Public Administrator Registration

- Route: `/register-admin`
- The first registered administrator becomes a `SUPERADMIN`.

### Public Employee Registration

- Route: `/register-employee`
- Employees can register with or without an administrator code.

### Joining a Team by Code

1. The administrator shares their code.
2. The employee creates or uses their profile.
3. A request is generated.
4. The administrator or superadministrator reviews it in the Team section.

### Issue Management

1. The employee requests a correction in Reports.
2. The administrator or superadministrator reviews it in Reports.

### Notifications

Each notification redirects the user to the screen where the relevant action can be performed.

### Inactive Billing Lock

- If an `ADMIN` loses their subscription and has no manual limit, time tracking is blocked for both the administrator and all their employees.
- In this state, the administrator can only access Dashboard and Billing.
- Affected employees can only access Dashboard.
- The dashboard displays a warning that the data may be deleted after six months if the situation is not resolved.

## Requirements

- Node.js 20+
- npm 10+
- Docker Desktop, recommended.

## 1. Quick Local Development with Docker

Copy the environment variables:

```bash
cp .env.example .env
Start the complete environment:

docker compose up --build
To load a heavily populated test database, first enable the following option in .env:

RUN_DEMO_FIXTURES=true
URLs
Frontend: http://localhost:8100

API health: http://localhost:4000/health

API readiness: http://localhost:4000/health/ready

Profile pictures are stored in a Docker volume separate from the backend container.

Demo Credentials
Available when RUN_SEED=true:

superadmin@regismatic.local / Regismatic2026!
admin@regismatic.local / Regismatic2026!
empleado@regismatic.local / Regismatic2026!
You can also create new administrators from the public registration screen:

http://localhost:8100/register-admin
You can create new employees from:

http://localhost:8100/register-employee
Optional Large Demo Dataset
In addition to the basic seed, an optional and much more complete fixture dataset is available for reviewing the application with a realistic amount of data:

Several administrators and one test superadministrator.

Dozens of employees.

Several weeks of time entries.

Manual adjustments.

Pending, approved, and rejected correction requests.

Pending, approved, and rejected team membership requests.

Related notifications.

It does not run automatically unless you invoke it explicitly or enable RUN_DEMO_FIXTURES=true in Docker.

Run it manually with:

npm run seed:fixtures
Characteristics:

It can be run repeatedly.

It deletes previous fixtures before recreating them.

It only modifies users in the @fixtures.regismatic.local domain.

It does not replace the basic seed; it complements it.

Shared fixture password:

Regismatic2026!
Examples:

superadmin.fixture@fixtures.regismatic.local
admin1.fixture@fixtures.regismatic.local
empleado-1-1@fixtures.regismatic.local
pendiente-1@fixtures.regismatic.local
2. Local Development without Docker
Install the root dependencies:

npm install
Backend
cp backend/.env.example backend/.env
npm run prisma:generate --workspace backend
npm run prisma:migrate --workspace backend
npm run seed --workspace backend

# Optional:
npm run seed:fixtures --workspace backend

npm run dev:api
Main backend variables:

DATABASE_URL

JWT_SECRET

CORS_ORIGIN

PORT

JSON_BODY_LIMIT

API_RATE_LIMIT_WINDOW_MS

API_RATE_LIMIT_MAX

BILLING_TRIAL_DAYS

BILLING_TRIAL_SEAT_LIMIT

BILLING_TRIAL_IP_ENFORCEMENT

STRIPE_SECRET_KEY

STRIPE_WEBHOOK_SECRET

STRIPE_PRICE_PACK_10_MONTHLY

STRIPE_PRICE_PACK_10_YEARLY

STRIPE_PRICE_PACK_20_MONTHLY

STRIPE_PRICE_PACK_20_YEARLY

STRIPE_PRICE_PACK_50_MONTHLY

STRIPE_PRICE_PACK_50_YEARLY

STRIPE_PRICE_PACK_100_MONTHLY

STRIPE_PRICE_PACK_100_YEARLY

STRIPE_CHECKOUT_SUCCESS_URL

STRIPE_CHECKOUT_CANCEL_URL

STRIPE_BILLING_PORTAL_RETURN_URL

FCM_SERVICE_ACCOUNT_JSON

FCM_SERVICE_ACCOUNT_PATH

Frontend
In another terminal:

cp frontend/.env.example frontend/.env
npm run dev:web
Notes:

npm run dev:web uses ionic serve.

The frontend is available at http://localhost:8100.

The backend is available at http://localhost:4000.

When using the project's Docker PostgreSQL instance, the locally exposed port is 5433.

Recommended flow for testing public employee registration:

Sign in as admin@regismatic.local or superadmin@regismatic.local.

Go to Team and copy the team's access code.

Sign out and open http://localhost:8100/register-employee.

Create the employee profile and enter that code.

Sign in again as the administrator to approve or reject the pending request.

3. Production with TLS Using Caddy
Copy the production template:

cp .env.production.example .env.production
Configure at least:

POSTGRES_PASSWORD

JWT_SECRET

APP_DOMAIN

API_DOMAIN

VITE_API_BASE_URL

RUN_SEED=false

RUN_DEMO_FIXTURES=false

STRIPE_SECRET_KEY

STRIPE_WEBHOOK_SECRET

STRIPE_PRICE_PACK_10_MONTHLY

STRIPE_PRICE_PACK_10_YEARLY

STRIPE_PRICE_PACK_20_MONTHLY

STRIPE_PRICE_PACK_20_YEARLY

STRIPE_PRICE_PACK_50_MONTHLY

STRIPE_PRICE_PACK_50_YEARLY

STRIPE_PRICE_PACK_100_MONTHLY

STRIPE_PRICE_PACK_100_YEARLY

STRIPE_CHECKOUT_SUCCESS_URL

STRIPE_CHECKOUT_CANCEL_URL

STRIPE_BILLING_PORTAL_RETURN_URL

Deploy:

docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
Extended guide: docs/deploy-production.md

3.1 Stripe Billing
The integration uses Stripe Checkout to subscribe to or change a plan and the Customer Portal to manage billing.

A public key is not required in the frontend because the Stripe redirect is created by the backend.

A SUPERADMIN can assign a manual user limit to any ADMIN from Billing.

When a manual limit exists:

It takes precedence over the trial or Stripe subscription.

It can be removed at any time.

The affected administrator is notified automatically.

Keys and IDs that must be configured:

STRIPE_SECRET_KEY: secret key for your Stripe account.

STRIPE_WEBHOOK_SECRET: secret for the Stripe webhook endpoint.

STRIPE_PRICE_PACK_10_MONTHLY

STRIPE_PRICE_PACK_10_YEARLY

STRIPE_PRICE_PACK_20_MONTHLY

STRIPE_PRICE_PACK_20_YEARLY

STRIPE_PRICE_PACK_50_MONTHLY

STRIPE_PRICE_PACK_50_YEARLY

STRIPE_PRICE_PACK_100_MONTHLY

STRIPE_PRICE_PACK_100_YEARLY

STRIPE_CHECKOUT_SUCCESS_URL

STRIPE_CHECKOUT_CANCEL_URL

STRIPE_BILLING_PORTAL_RETURN_URL

The backend webhook listens at:

POST /api/billing/webhook
You can test it locally with the Stripe CLI:

stripe listen --forward-to http://localhost:4000/api/billing/webhook
4. PostgreSQL Backups and Restore
Linux/macOS
./scripts/backup-db.sh
./scripts/restore-db.sh ./backups/archivo.sql.gz
PowerShell
./scripts/backup-db.ps1
./scripts/restore-db.ps1 -BackupFile .\backups\archivo.sql
5. Mobile with Capacitor
From frontend/:

npm run build
npm run cap:sync
npx cap add android

# Or:
npx cap add ios
For native Android/iOS push notifications, which are optional but recommended:

Configure Firebase Cloud Messaging.

Define one of the following backend variables:

FCM_SERVICE_ACCOUNT_JSON: the complete JSON on a single line.

FCM_SERVICE_ACCOUNT_PATH: path to the service account JSON file.

Synchronize the platforms after configuration:

cd frontend
npm run cap:sync
6. Profile Pictures
Each user can upload or remove their own picture from the account menu.

ADMIN and SUPERADMIN users can also manage the pictures of users visible in Team.

When no picture exists, the application displays an initials-based avatar.

Supported formats: JPG, PNG, WEBP, and GIF.

Maximum API upload size: 512 KB.

The application crops and compresses the picture before uploading it to keep the file small.

In Docker, images are persisted in the regismatic-uploads volume.

7. Demo Data and Fixtures
npm run seed
Loads the basic seed.

Creates the minimum demo accounts required to get started quickly.

npm run seed:fixtures
Loads large, repeatable fixtures.

Useful for demos, visual QA, and flow testing.

RUN_SEED
Controls whether Docker runs the basic seed when the API starts.

RUN_DEMO_FIXTURES
Controls whether Docker also runs the large fixture dataset.

8. Operational Notes
In-app and push notifications redirect users to the screen where they can be managed.

Profile pictures are stored on the backend's disk and served through an authenticated API endpoint.

PostgreSQL is not publicly exposed in production.

The API runs prisma migrate deploy when starting in Docker.

9. Quick Troubleshooting
ionic serve cannot connect to the backend
Check:

http://localhost:4000/health
Login or requests fail because of the database
Verify that PostgreSQL is accessible and that DATABASE_URL is correct.

Profile pictures are not displayed
Verify that the backend is running and that the session is still valid for loading protected resources.

Push notifications do not work
Review the FCM configuration and the Capacitor synchronization.

You want to populate a large amount of test data
Run:

npm run seed:fixtures
Additional Documentation
Legal + Benchmark

Production Deployment

Session Isolation Checklist

Backend README

Frontend README

Notice
This application helps with the operational requirements of working-time record keeping, but it does not replace professional legal advice.
"""

output_path = Path("/mnt/data/Regismatic_README_EN.md")
output_path.write_text(translated, encoding="utf-8")

print(f"Created: {output_path}")
print(f"Characters: {len(translated):,}")
print(f"Lines: {translated.count(chr(10)) + 1:,}")

STDOUT/STDERR
Created: /mnt/data/Regismatic_README_EN.md
Characters: 15,698
Lines: 545
Sí. He traducido el documento completo, manteniendo intactos los comandos, rutas, variables de entorno y credenciales. 


Regismatic_README_EN.md

Regismatic
A time tracking application for Spain with two separate projects in the same repository:

frontend/: Ionic Angular responsive web application with a mobile foundation using Capacitor.

backend/: Express API with Prisma and PostgreSQL.

The database is PostgreSQL (SQL), not SQLite.

Quick Overview
Monorepo with separate frontend and backend projects.

Ionic Angular frontend prepared for responsive web and mobile use with Capacitor.

Express backend with Prisma and PostgreSQL.

Roles:

EMPLOYEE

ADMIN

SUPERADMIN

Supports multiple administrators and separate teams.

Includes in-app and push notifications.

Includes Stripe plan billing for administrators.

If an ADMIN has neither an active subscription nor a manual limit, neither the administrator nor their team can clock in or out.

When an administrator account has neither a subscription nor a manual limit, the application warns that its data may be deleted after six months.

Includes basic demo data and optional large demo fixtures.

Structure
frontend

backend

docker-compose.yml: local environment.

docker-compose.prod.yml: production environment with TLS using Caddy.

docs/deploy-production.md: deployment to a self-hosted server with Docker Compose.

docs/deploy-railway.md: full Railway deployment.

docs/deploy-railway-paso-a-paso.md: detailed step-by-step Railway guide for users with no previous experience.

infra/caddy/Caddyfile

scripts: database backup and restore scripts.

Features
JWT login with SUPERADMIN, ADMIN, and EMPLOYEE roles.

Public administrator registration from the application itself at /register-admin.

Plan-based billing for administrators:

Seven-day trial for three users.

Pack 10 with monthly and yearly pricing defined in Stripe.

Pack 20: EUR 29/month.

Pack 50: EUR 59/month.

Pack 100: EUR 99/month.

Monthly and yearly plans in Stripe.

Stripe Checkout and Customer Portal.

A SUPERADMIN can set manual user limits for each ADMIN.

A manual limit takes precedence over Stripe until it is removed.

Public employee registration from the application itself at /register-employee.

The first publicly registered administrator is automatically promoted to SUPERADMIN.

New administrators start with a seven-day, three-user trial.

The public trial uses the originating IP address to help prevent multiple trial accounts from the same source.

Multi-administrator support: each administrator manages only their own workforce.

Code-based team onboarding flow:

Each ADMIN has their own access code.

An employee can create a profile, enter the code, and submit a request to join the team.

The target ADMIN can approve or reject the request.

A SUPERADMIN can review everything, view administrator codes, and take action without depending on third-party approval.

Time tracking:

Clock in.

Start and end breaks.

Clock out.

Event traceability with an audit trail of changes, including who made each change and when.

Optional geolocation for each event.

Manual adjustments by administrators.

Date-range reports and Excel export (.xlsx) with pivot-table-style summary sheets.

Correction requests submitted by employees.

Request review and direct record editing by administrators.

Prioritized issue center for administrators, displayed at the top of the reports area.

In-app notifications and Android/iOS push notifications using FCM.

Per-user profile pictures, with a default avatar when no image is available.

Scope-based user management:

ADMIN: can only create and manage their own employees.

SUPERADMIN: can view everything, create administrators, superadministrators, and assigned employees, and reassign employees between administrators.

Optional large demo fixture dataset for visual and functional testing.

Basic API hardening:

Configurable CORS.

Rate limiting.

Global payload sanitization.

Strict schemas.

Health checks.

Functional Architecture
frontend/
Responsive web interface.

Mobile support with Capacitor.

Theme, language, notification, and role-based navigation management.

backend/
JWT authentication.

Business rules for time tracking, issues, teams, and notifications.

Prisma as the SQL access layer.

PostgreSQL
Stores users, time entries, requests, notifications, and push tokens.

Caddy
TLS reverse proxy in production.

Roles and Permissions
EMPLOYEE
Tracks their own working day when their administrator has active billing or a manual limit.

Views their records.

Requests corrections.

Can create their profile publicly.

Can request to join a team using an administrator code.

ADMIN
Manages only their own team.

Creates employees directly.

Their employee limit depends on the active plan.

If they have neither an active subscription nor a manual limit, they can only use the Dashboard and Billing sections until the account is brought back into good standing.

Approves or rejects correction requests from their team.

Approves or rejects requests to join their team.

Can modify records belonging to their workforce.

SUPERADMIN
Has global visibility.

Can create ADMIN, SUPERADMIN, and EMPLOYEE users.

Can reassign employees between administrators.

Can review any issue and any request to join a team.

Can set or remove manual user limits for any ADMIN.

Does not depend on third-party approval.

Is not restricted by plans or Stripe.

Main Flows
Public Administrator Registration
Route: /register-admin

The first registered administrator becomes a SUPERADMIN.

Public Employee Registration
Route: /register-employee

Employees can register with or without an administrator code.

Joining a Team by Code
The administrator shares their code.

The employee creates or uses their profile.

A request is generated.

The administrator or superadministrator reviews it in the Team section.

Issue Management
The employee requests a correction in Reports.

The administrator or superadministrator reviews it in Reports.

Notifications
Each notification redirects the user to the screen where the relevant action can be performed.

Inactive Billing Lock
If an ADMIN loses their subscription and has no manual limit, time tracking is blocked for both the administrator and all their employees.

In this state, the administrator can only access Dashboard and Billing.

Affected employees can only access Dashboard.

The dashboard displays a warning that the data may be deleted after six months if the situation is not resolved.

Requirements
Node.js 20+

npm 10+

Docker Desktop, recommended.

1. Quick Local Development with Docker
Copy the environment variables:

cp .env.example .env
Start the complete environment:

docker compose up --build
To load a heavily populated test database, first enable the following option in .env:

RUN_DEMO_FIXTURES=true
URLs
Frontend: http://localhost:8100

API health: http://localhost:4000/health

API readiness: http://localhost:4000/health/ready

Profile pictures are stored in a Docker volume separate from the backend container.

Demo Credentials
Available when RUN_SEED=true:

superadmin@regismatic.local / Regismatic2026!
admin@regismatic.local / Regismatic2026!
empleado@regismatic.local / Regismatic2026!
You can also create new administrators from the public registration screen:

http://localhost:8100/register-admin
You can create new employees from:

http://localhost:8100/register-employee
Optional Large Demo Dataset
In addition to the basic seed, an optional and much more complete fixture dataset is available for reviewing the application with a realistic amount of data:

Several administrators and one test superadministrator.

Dozens of employees.

Several weeks of time entries.

Manual adjustments.

Pending, approved, and rejected correction requests.

Pending, approved, and rejected team membership requests.

Related notifications.

It does not run automatically unless you invoke it explicitly or enable RUN_DEMO_FIXTURES=true in Docker.

Run it manually with:

npm run seed:fixtures
Characteristics:

It can be run repeatedly.

It deletes previous fixtures before recreating them.

It only modifies users in the @fixtures.regismatic.local domain.

It does not replace the basic seed; it complements it.

Shared fixture password:

Regismatic2026!
Examples:

superadmin.fixture@fixtures.regismatic.local
admin1.fixture@fixtures.regismatic.local
empleado-1-1@fixtures.regismatic.local
pendiente-1@fixtures.regismatic.local
2. Local Development without Docker
Install the root dependencies:

npm install
Backend
cp backend/.env.example backend/.env
npm run prisma:generate --workspace backend
npm run prisma:migrate --workspace backend
npm run seed --workspace backend

# Optional:
npm run seed:fixtures --workspace backend

npm run dev:api
Main backend variables:

DATABASE_URL

JWT_SECRET

CORS_ORIGIN

PORT

JSON_BODY_LIMIT

API_RATE_LIMIT_WINDOW_MS

API_RATE_LIMIT_MAX

BILLING_TRIAL_DAYS

BILLING_TRIAL_SEAT_LIMIT

BILLING_TRIAL_IP_ENFORCEMENT

STRIPE_SECRET_KEY

STRIPE_WEBHOOK_SECRET

STRIPE_PRICE_PACK_10_MONTHLY

STRIPE_PRICE_PACK_10_YEARLY

STRIPE_PRICE_PACK_20_MONTHLY

STRIPE_PRICE_PACK_20_YEARLY

STRIPE_PRICE_PACK_50_MONTHLY

STRIPE_PRICE_PACK_50_YEARLY

STRIPE_PRICE_PACK_100_MONTHLY

STRIPE_PRICE_PACK_100_YEARLY

STRIPE_CHECKOUT_SUCCESS_URL

STRIPE_CHECKOUT_CANCEL_URL

STRIPE_BILLING_PORTAL_RETURN_URL

FCM_SERVICE_ACCOUNT_JSON

FCM_SERVICE_ACCOUNT_PATH

Frontend
In another terminal:

cp frontend/.env.example frontend/.env
npm run dev:web
Notes:

npm run dev:web uses ionic serve.

The frontend is available at http://localhost:8100.

The backend is available at http://localhost:4000.

When using the project's Docker PostgreSQL instance, the locally exposed port is 5433.

Recommended flow for testing public employee registration:

Sign in as admin@regismatic.local or superadmin@regismatic.local.

Go to Team and copy the team's access code.

Sign out and open http://localhost:8100/register-employee.

Create the employee profile and enter that code.

Sign in again as the administrator to approve or reject the pending request.

3. Production with TLS Using Caddy
Copy the production template:

cp .env.production.example .env.production
Configure at least:

POSTGRES_PASSWORD

JWT_SECRET

APP_DOMAIN

API_DOMAIN

VITE_API_BASE_URL

RUN_SEED=false

RUN_DEMO_FIXTURES=false

STRIPE_SECRET_KEY

STRIPE_WEBHOOK_SECRET

STRIPE_PRICE_PACK_10_MONTHLY

STRIPE_PRICE_PACK_10_YEARLY

STRIPE_PRICE_PACK_20_MONTHLY

STRIPE_PRICE_PACK_20_YEARLY

STRIPE_PRICE_PACK_50_MONTHLY

STRIPE_PRICE_PACK_50_YEARLY

STRIPE_PRICE_PACK_100_MONTHLY

STRIPE_PRICE_PACK_100_YEARLY

STRIPE_CHECKOUT_SUCCESS_URL

STRIPE_CHECKOUT_CANCEL_URL

STRIPE_BILLING_PORTAL_RETURN_URL

Deploy:

docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
Extended guide: docs/deploy-production.md

3.1 Stripe Billing
The integration uses Stripe Checkout to subscribe to or change a plan and the Customer Portal to manage billing.

A public key is not required in the frontend because the Stripe redirect is created by the backend.

A SUPERADMIN can assign a manual user limit to any ADMIN from Billing.

When a manual limit exists:

It takes precedence over the trial or Stripe subscription.

It can be removed at any time.

The affected administrator is notified automatically.

Keys and IDs that must be configured:

STRIPE_SECRET_KEY: secret key for your Stripe account.

STRIPE_WEBHOOK_SECRET: secret for the Stripe webhook endpoint.

STRIPE_PRICE_PACK_10_MONTHLY

STRIPE_PRICE_PACK_10_YEARLY

STRIPE_PRICE_PACK_20_MONTHLY

STRIPE_PRICE_PACK_20_YEARLY

STRIPE_PRICE_PACK_50_MONTHLY

STRIPE_PRICE_PACK_50_YEARLY

STRIPE_PRICE_PACK_100_MONTHLY

STRIPE_PRICE_PACK_100_YEARLY

STRIPE_CHECKOUT_SUCCESS_URL

STRIPE_CHECKOUT_CANCEL_URL

STRIPE_BILLING_PORTAL_RETURN_URL

The backend webhook listens at:

POST /api/billing/webhook
You can test it locally with the Stripe CLI:

stripe listen --forward-to http://localhost:4000/api/billing/webhook
4. PostgreSQL Backups and Restore
Linux/macOS
./scripts/backup-db.sh
./scripts/restore-db.sh ./backups/archivo.sql.gz
PowerShell
./scripts/backup-db.ps1
./scripts/restore-db.ps1 -BackupFile .\backups\archivo.sql
5. Mobile with Capacitor
From frontend/:

npm run build
npm run cap:sync
npx cap add android

# Or:
npx cap add ios
For native Android/iOS push notifications, which are optional but recommended:

Configure Firebase Cloud Messaging.

Define one of the following backend variables:

FCM_SERVICE_ACCOUNT_JSON: the complete JSON on a single line.

FCM_SERVICE_ACCOUNT_PATH: path to the service account JSON file.

Synchronize the platforms after configuration:

cd frontend
npm run cap:sync
6. Profile Pictures
Each user can upload or remove their own picture from the account menu.

ADMIN and SUPERADMIN users can also manage the pictures of users visible in Team.

When no picture exists, the application displays an initials-based avatar.

Supported formats: JPG, PNG, WEBP, and GIF.

Maximum API upload size: 512 KB.

The application crops and compresses the picture before uploading it to keep the file small.

In Docker, images are persisted in the regismatic-uploads volume.

7. Demo Data and Fixtures
npm run seed
Loads the basic seed.

Creates the minimum demo accounts required to get started quickly.

npm run seed:fixtures
Loads large, repeatable fixtures.

Useful for demos, visual QA, and flow testing.

RUN_SEED
Controls whether Docker runs the basic seed when the API starts.

RUN_DEMO_FIXTURES
Controls whether Docker also runs the large fixture dataset.

8. Operational Notes
In-app and push notifications redirect users to the screen where they can be managed.

Profile pictures are stored on the backend's disk and served through an authenticated API endpoint.

PostgreSQL is not publicly exposed in production.

The API runs prisma migrate deploy when starting in Docker.

9. Quick Troubleshooting
ionic serve cannot connect to the backend
Check:

http://localhost:4000/health
Login or requests fail because of the database
Verify that PostgreSQL is accessible and that DATABASE_URL is correct.

Profile pictures are not displayed
Verify that the backend is running and that the session is still valid for loading protected resources.

Push notifications do not work
Review the FCM configuration and the Capacitor synchronization.

You want to populate a large amount of test data
Run:

npm run seed:fixtures
Additional Documentation
Legal + Benchmark

Production Deployment

Session Isolation Checklist

Backend README

Frontend README

Notice
This application helps with the operational requirements of working-time record keeping, but it does not replace professional legal advice.
::: ​​


damelo todo en un archivo, porque te has hecho un lio tremendo 

Aquí lo tienes todo en un único archivo Markdown:

Regismatic_README_EN.md


Biblioteca
/
Regismatic_README_EN.md


# Regismatic

A time tracking application for Spain with two separate projects in the same repository:

- `frontend/`: Ionic Angular responsive web application with a mobile foundation using Capacitor.
- `backend/`: Express API with Prisma and PostgreSQL.

The database is PostgreSQL (SQL), not SQLite.

## Quick Overview

- Monorepo with separate frontend and backend projects.
- Ionic Angular frontend prepared for responsive web and mobile use with Capacitor.
- Express backend with Prisma and PostgreSQL.
- Roles:
  - `EMPLOYEE`
  - `ADMIN`
  - `SUPERADMIN`
- Supports multiple administrators and separate teams.
- Includes in-app and push notifications.
- Includes Stripe plan billing for administrators.
- If an `ADMIN` has neither an active subscription nor a manual limit, neither the administrator nor their team can clock in or out.
- When an administrator account has neither a subscription nor a manual limit, the application warns that its data may be deleted after six months.
- Includes basic demo data and optional large demo fixtures.

## Structure

- `frontend`
- `backend`
- `docker-compose.yml`: local environment.
- `docker-compose.prod.yml`: production environment with TLS using Caddy.
- `docs/deploy-production.md`: deployment to a self-hosted server with Docker Compose.
- `docs/deploy-railway.md`: full Railway deployment.
- `docs/deploy-railway-paso-a-paso.md`: detailed step-by-step Railway guide for users with no previous experience.
- `infra/caddy/Caddyfile`
- `scripts`: database backup and restore scripts.

## Features

- JWT login with `SUPERADMIN`, `ADMIN`, and `EMPLOYEE` roles.
- Public administrator registration from the application itself at `/register-admin`.
- Plan-based billing for administrators:
  - Seven-day trial for three users.
  - Pack 10 with monthly and yearly pricing defined in Stripe.
  - Pack 20: EUR 29/month.
  - Pack 50: EUR 59/month.
  - Pack 100: EUR 99/month.
  - Monthly and yearly plans in Stripe.
  - Stripe Checkout and Customer Portal.
  - A `SUPERADMIN` can set manual user limits for each `ADMIN`.
  - A manual limit takes precedence over Stripe until it is removed.
- Public employee registration from the application itself at `/register-employee`.
- The first publicly registered administrator is automatically promoted to `SUPERADMIN`.
- New administrators start with a seven-day, three-user trial.
- The public trial uses the originating IP address to help prevent multiple trial accounts from the same source.
- Multi-administrator support: each administrator manages only their own workforce.
- Code-based team onboarding flow:
  - Each `ADMIN` has their own access code.
  - An employee can create a profile, enter the code, and submit a request to join the team.
  - The target `ADMIN` can approve or reject the request.
  - A `SUPERADMIN` can review everything, view administrator codes, and take action without depending on third-party approval.
- Time tracking:
  - Clock in.
  - Start and end breaks.
  - Clock out.
- Event traceability with an audit trail of changes, including who made each change and when.
- Optional geolocation for each event.
- Manual adjustments by administrators.
- Date-range reports and Excel export (`.xlsx`) with pivot-table-style summary sheets.
- Correction requests submitted by employees.
- Request review and direct record editing by administrators.
- Prioritized issue center for administrators, displayed at the top of the reports area.
- In-app notifications and Android/iOS push notifications using FCM.
- Per-user profile pictures, with a default avatar when no image is available.
- Scope-based user management:
  - `ADMIN`: can only create and manage their own employees.
  - `SUPERADMIN`: can view everything, create administrators, superadministrators, and assigned employees, and reassign employees between administrators.
- Optional large demo fixture dataset for visual and functional testing.
- Basic API hardening:
  - Configurable CORS.
  - Rate limiting.
  - Global payload sanitization.
  - Strict schemas.
  - Health checks.

## Functional Architecture

### `frontend/`

- Responsive web interface.
- Mobile support with Capacitor.
- Theme, language, notification, and role-based navigation management.

### `backend/`

- JWT authentication.
- Business rules for time tracking, issues, teams, and notifications.
- Prisma as the SQL access layer.

### PostgreSQL

- Stores users, time entries, requests, notifications, and push tokens.

### Caddy

- TLS reverse proxy in production.

## Roles and Permissions

### `EMPLOYEE`

- Tracks their own working day when their administrator has active billing or a manual limit.
- Views their records.
- Requests corrections.
- Can create their profile publicly.
- Can request to join a team using an administrator code.

### `ADMIN`

- Manages only their own team.
- Creates employees directly.
- Their employee limit depends on the active plan.
- If they have neither an active subscription nor a manual limit, they can only use the Dashboard and Billing sections until the account is brought back into good standing.
- Approves or rejects correction requests from their team.
- Approves or rejects requests to join their team.
- Can modify records belonging to their workforce.

### `SUPERADMIN`

- Has global visibility.
- Can create `ADMIN`, `SUPERADMIN`, and `EMPLOYEE` users.
- Can reassign employees between administrators.
- Can review any issue and any request to join a team.
- Can set or remove manual user limits for any `ADMIN`.
- Does not depend on third-party approval.
- Is not restricted by plans or Stripe.

## Main Flows

### Public Administrator Registration

- Route: `/register-admin`
- The first registered administrator becomes a `SUPERADMIN`.

### Public Employee Registration

- Route: `/register-employee`
- Employees can register with or without an administrator code.

### Joining a Team by Code

1. The administrator shares their code.
2. The employee creates or uses their profile.
3. A request is generated.
4. The administrator or superadministrator reviews it in the Team section.

### Issue Management

1. The employee requests a correction in Reports.
2. The administrator or superadministrator reviews it in Reports.

### Notifications

Each notification redirects the user to the screen where the relevant action can be performed.

### Inactive Billing Lock

- If an `ADMIN` loses their subscription and has no manual limit, time tracking is blocked for both the administrator and all their employees.
- In this state, the administrator can only access Dashboard and Billing.
- Affected employees can only access Dashboard.
- The dashboard displays a warning that the data may be deleted after six months if the situation is not resolved.

## Requirements

- Node.js 20+
- npm 10+
- Docker Desktop, recommended.

## 1. Quick Local Development with Docker

Copy the environment variables:

```bash
cp .env.example .env
```

Start the complete environment:

```bash
docker compose up --build
```

To load a heavily populated test database, first enable the following option in `.env`:

```env
RUN_DEMO_FIXTURES=true
```

### URLs

- Frontend: `http://localhost:8100`
- API health: `http://localhost:4000/health`
- API readiness: `http://localhost:4000/health/ready`
- Profile pictures are stored in a Docker volume separate from the backend container.

### Demo Credentials

Available when `RUN_SEED=true`:

```text
superadmin@regismatic.local / Regismatic2026!
admin@regismatic.local / Regismatic2026!
empleado@regismatic.local / Regismatic2026!
```

You can also create new administrators from the public registration screen:

```text
http://localhost:8100/register-admin
```

You can create new employees from:

```text
http://localhost:8100/register-employee
```

### Optional Large Demo Dataset

In addition to the basic seed, an optional and much more complete fixture dataset is available for reviewing the application with a realistic amount of data:

- Several administrators and one test superadministrator.
- Dozens of employees.
- Several weeks of time entries.
- Manual adjustments.
- Pending, approved, and rejected correction requests.
- Pending, approved, and rejected team membership requests.
- Related notifications.

It does not run automatically unless you invoke it explicitly or enable `RUN_DEMO_FIXTURES=true` in Docker.

Run it manually with:

```bash
npm run seed:fixtures
```

Characteristics:

- It can be run repeatedly.
- It deletes previous fixtures before recreating them.
- It only modifies users in the `@fixtures.regismatic.local` domain.
- It does not replace the basic seed; it complements it.

Shared fixture password:

```text
Regismatic2026!
```

Examples:

```text
superadmin.fixture@fixtures.regismatic.local
admin1.fixture@fixtures.regismatic.local
empleado-1-1@fixtures.regismatic.local
pendiente-1@fixtures.regismatic.local
```

## 2. Local Development without Docker

Install the root dependencies:

```bash
npm install
```

### Backend

```bash
cp backend/.env.example backend/.env
npm run prisma:generate --workspace backend
npm run prisma:migrate --workspace backend
npm run seed --workspace backend

# Optional:
npm run seed:fixtures --workspace backend

npm run dev:api
```

Main backend variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `PORT`
- `JSON_BODY_LIMIT`
- `API_RATE_LIMIT_WINDOW_MS`
- `API_RATE_LIMIT_MAX`
- `BILLING_TRIAL_DAYS`
- `BILLING_TRIAL_SEAT_LIMIT`
- `BILLING_TRIAL_IP_ENFORCEMENT`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PACK_10_MONTHLY`
- `STRIPE_PRICE_PACK_10_YEARLY`
- `STRIPE_PRICE_PACK_20_MONTHLY`
- `STRIPE_PRICE_PACK_20_YEARLY`
- `STRIPE_PRICE_PACK_50_MONTHLY`
- `STRIPE_PRICE_PACK_50_YEARLY`
- `STRIPE_PRICE_PACK_100_MONTHLY`
- `STRIPE_PRICE_PACK_100_YEARLY`
- `STRIPE_CHECKOUT_SUCCESS_URL`
- `STRIPE_CHECKOUT_CANCEL_URL`
- `STRIPE_BILLING_PORTAL_RETURN_URL`
- `FCM_SERVICE_ACCOUNT_JSON`
- `FCM_SERVICE_ACCOUNT_PATH`

### Frontend

In another terminal:

```bash
cp frontend/.env.example frontend/.env
npm run dev:web
```

Notes:

- `npm run dev:web` uses `ionic serve`.
- The frontend is available at `http://localhost:8100`.
- The backend is available at `http://localhost:4000`.
- When using the project's Docker PostgreSQL instance, the locally exposed port is `5433`.

Recommended flow for testing public employee registration:

1. Sign in as `admin@regismatic.local` or `superadmin@regismatic.local`.
2. Go to Team and copy the team's access code.
3. Sign out and open `http://localhost:8100/register-employee`.
4. Create the employee profile and enter that code.
5. Sign in again as the administrator to approve or reject the pending request.

## 3. Production with TLS Using Caddy

Copy the production template:

```bash
cp .env.production.example .env.production
```

Configure at least:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `APP_DOMAIN`
- `API_DOMAIN`
- `VITE_API_BASE_URL`
- `RUN_SEED=false`
- `RUN_DEMO_FIXTURES=false`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PACK_10_MONTHLY`
- `STRIPE_PRICE_PACK_10_YEARLY`
- `STRIPE_PRICE_PACK_20_MONTHLY`
- `STRIPE_PRICE_PACK_20_YEARLY`
- `STRIPE_PRICE_PACK_50_MONTHLY`
- `STRIPE_PRICE_PACK_50_YEARLY`
- `STRIPE_PRICE_PACK_100_MONTHLY`
- `STRIPE_PRICE_PACK_100_YEARLY`
- `STRIPE_CHECKOUT_SUCCESS_URL`
- `STRIPE_CHECKOUT_CANCEL_URL`
- `STRIPE_BILLING_PORTAL_RETURN_URL`

Deploy:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Extended guide: `docs/deploy-production.md`

### 3.1 Stripe Billing

The integration uses Stripe Checkout to subscribe to or change a plan and the Customer Portal to manage billing.

A public key is not required in the frontend because the Stripe redirect is created by the backend.

A `SUPERADMIN` can assign a manual user limit to any `ADMIN` from Billing.

When a manual limit exists:

- It takes precedence over the trial or Stripe subscription.
- It can be removed at any time.
- The affected administrator is notified automatically.

Keys and IDs that must be configured:

- `STRIPE_SECRET_KEY`: secret key for your Stripe account.
- `STRIPE_WEBHOOK_SECRET`: secret for the Stripe webhook endpoint.
- `STRIPE_PRICE_PACK_10_MONTHLY`
- `STRIPE_PRICE_PACK_10_YEARLY`
- `STRIPE_PRICE_PACK_20_MONTHLY`
- `STRIPE_PRICE_PACK_20_YEARLY`
- `STRIPE_PRICE_PACK_50_MONTHLY`
- `STRIPE_PRICE_PACK_50_YEARLY`
- `STRIPE_PRICE_PACK_100_MONTHLY`
- `STRIPE_PRICE_PACK_100_YEARLY`
- `STRIPE_CHECKOUT_SUCCESS_URL`
- `STRIPE_CHECKOUT_CANCEL_URL`
- `STRIPE_BILLING_PORTAL_RETURN_URL`

The backend webhook listens at:

```http
POST /api/billing/webhook
```

You can test it locally with the Stripe CLI:

```bash
stripe listen --forward-to http://localhost:4000/api/billing/webhook
```

## 4. PostgreSQL Backups and Restore

### Linux/macOS

```bash
./scripts/backup-db.sh
./scripts/restore-db.sh ./backups/archivo.sql.gz
```

### PowerShell

```powershell
./scripts/backup-db.ps1
./scripts/restore-db.ps1 -BackupFile .\backups\archivo.sql
```

## 5. Mobile with Capacitor

From `frontend/`:

```bash
npm run build
npm run cap:sync
npx cap add android

# Or:
npx cap add ios
```

For native Android/iOS push notifications, which are optional but recommended:

1. Configure Firebase Cloud Messaging.
2. Define one of the following backend variables:
   - `FCM_SERVICE_ACCOUNT_JSON`: the complete JSON on a single line.
   - `FCM_SERVICE_ACCOUNT_PATH`: path to the service account JSON file.
3. Synchronize the platforms after configuration:

```bash
cd frontend
npm run cap:sync
```

## 6. Profile Pictures

- Each user can upload or remove their own picture from the account menu.
- `ADMIN` and `SUPERADMIN` users can also manage the pictures of users visible in Team.
- When no picture exists, the application displays an initials-based avatar.
- Supported formats: JPG, PNG, WEBP, and GIF.
- Maximum API upload size: 512 KB.
- The application crops and compresses the picture before uploading it to keep the file small.
- In Docker, images are persisted in the `regismatic-uploads` volume.

## 7. Demo Data and Fixtures

### `npm run seed`

- Loads the basic seed.
- Creates the minimum demo accounts required to get started quickly.

### `npm run seed:fixtures`

- Loads large, repeatable fixtures.
- Useful for demos, visual QA, and flow testing.

### `RUN_SEED`

Controls whether Docker runs the basic seed when the API starts.

### `RUN_DEMO_FIXTURES`

Controls whether Docker also runs the large fixture dataset.

## 8. Operational Notes

- In-app and push notifications redirect users to the screen where they can be managed.
- Profile pictures are stored on the backend's disk and served through an authenticated API endpoint.
- PostgreSQL is not publicly exposed in production.
- The API runs `prisma migrate deploy` when starting in Docker.

## 9. Quick Troubleshooting

### `ionic serve` cannot connect to the backend

Check:

```text
http://localhost:4000/health
```

### Login or requests fail because of the database

Verify that PostgreSQL is accessible and that `DATABASE_URL` is correct.

### Profile pictures are not displayed

Verify that the backend is running and that the session is still valid for loading protected resources.

### Push notifications do not work

Review the FCM configuration and the Capacitor synchronization.

### You want to populate a large amount of test data

Run:

```bash
npm run seed:fixtures
```

## Additional Documentation

- Legal + Benchmark
- Production Deployment
- Session Isolation Checklist
- Backend README
- Frontend README

## Notice

This application helps with the operational requirements of working-time record keeping, but it does not replace professional legal advice.
