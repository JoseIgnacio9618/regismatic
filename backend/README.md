# Backend (API)

API Express + TypeScript + Prisma + PostgreSQL.

## Requisitos
- Node 20+
- PostgreSQL 16+

## Configuracion
1. Copia variables:

```bash
cp .env.example .env
```

2. Genera cliente Prisma y migra:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
# opcional, para poblar muchos datos demo:
npm run seed:fixtures
```

3. Ejecuta API:

```bash
npm run dev
```

API por defecto: `http://localhost:4000`

## Variables importantes
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`
- `PORT`
- `AUTH_RATE_LIMIT_WINDOW_MS`
- `AUTH_RATE_LIMIT_MAX`
- `BILLING_TRIAL_DAYS`
- `BILLING_TRIAL_SEAT_LIMIT`
- `BILLING_TRIAL_IP_ENFORCEMENT`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PACK_10_MONTHLY`
- `STRIPE_PRICE_PACK_20_MONTHLY`
- `STRIPE_PRICE_PACK_50_MONTHLY`
- `STRIPE_PRICE_PACK_100_MONTHLY`
- `STRIPE_CHECKOUT_SUCCESS_URL`
- `STRIPE_CHECKOUT_CANCEL_URL`
- `STRIPE_BILLING_PORTAL_RETURN_URL`
- `FCM_SERVICE_ACCOUNT_JSON`
- `FCM_SERVICE_ACCOUNT_PATH`

## Fixtures demo opcionales
Existe una carga adicional de datos demo rica pensada para probar la aplicacion con volumen:
- varios administradores
- un superadmin de pruebas
- decenas de empleados
- muchas jornadas y fichajes
- solicitudes de correccion en varios estados
- solicitudes de union a equipo en varios estados
- notificaciones demo

Comando:

```bash
npm run seed:fixtures
```

Notas:
- no se ejecuta por defecto
- es reejecutable
- limpia y reconstruye solo los usuarios `@fixtures.regismatic.local`
- password comun de fixtures: `Regismatic2026!`

## Endpoints clave
- `POST /api/auth/login`
- `POST /api/auth/register-admin`
- `POST /api/auth/register-employee`
- `GET /api/auth/me`
- `GET /api/users`
- `POST /api/users`
- `GET /api/users/team-join-requests`
- `POST /api/users/team-join-requests`
- `POST /api/users/team-join-requests/:requestId/review`
- `GET /api/attendance/today`
- `POST /api/attendance/clock-in`
- `POST /api/attendance/break-start`
- `POST /api/attendance/break-end`
- `POST /api/attendance/clock-out`
- `GET /api/attendance/events?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=...`
- `PATCH /api/attendance/events/:eventId` (admin)
- `POST /api/attendance/events/:eventId/edit-requests` (employee)
- `GET /api/attendance/edit-requests`
- `PATCH /api/attendance/edit-requests/:requestId/review` (admin)
- `GET /api/notifications`
- `PATCH /api/notifications/read-all`
- `PATCH /api/notifications/:notificationId/read`
- `POST /api/notifications/push-token`
- `GET /api/reports/summary.xlsx`
- `GET /api/billing/overview`
- `POST /api/billing/checkout-session`
- `POST /api/billing/portal-session`
- `POST /api/billing/webhook`
- `GET /health`
- `GET /health/ready`

## Notas
- en Docker la entrada aplica `prisma migrate deploy` automaticamente
- si `RUN_SEED=true`, carga el seed basico
- si `RUN_DEMO_FIXTURES=true`, carga ademas los fixtures masivos
- los admins nuevos arrancan con demo de `7 dias / 10 usuarios`
- el backend aplica limites de plan tanto al crear empleados como al aprobar solicitudes de union a equipo
