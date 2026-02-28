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
```

3. Ejecuta API:

```bash
npm run dev
```

API por defecto: `http://localhost:4000`

## Endpoints clave
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/attendance/today`
- `POST /api/attendance/clock-in`
- `POST /api/attendance/break-start`
- `POST /api/attendance/break-end`
- `POST /api/attendance/clock-out`
- `GET /health`
- `GET /health/ready`
