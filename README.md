# Regismatic

Aplicacion de control horario para Espana con dos proyectos separados en el mismo repositorio:
- `frontend/`: Ionic Angular (web responsive + base para movil con Capacitor)
- `backend/`: API Express + Prisma + PostgreSQL

La base de datos es **PostgreSQL (SQL)**, no SQLite.

## Estructura
- [frontend](frontend)
- [backend](backend)
- [docker-compose.yml](docker-compose.yml): entorno local
- [docker-compose.prod.yml](docker-compose.prod.yml): produccion con TLS (Caddy)
- [infra/caddy/Caddyfile](infra/caddy/Caddyfile)
- [scripts](scripts): backup/restore de base de datos

## Funcionalidades
- Login JWT con roles `ADMIN` y `EMPLOYEE`
- Fichaje: entrada, pausa inicio/fin, salida
- Trazabilidad de eventos con auditoria de modificaciones (quien y cuando)
- Geolocalizacion opcional por evento
- Ajustes manuales (admin)
- Reportes por rango + export CSV
- Solicitudes de correccion por parte de empleados
- Revision de solicitudes y edicion directa de registros por administradores
- Gestion de usuarios (admin)
- Hardening basico de API: CORS configurable, rate limit de login, health checks

## Requisitos
- Node.js 20+
- npm 10+
- Docker Desktop (recomendado)

## 1) Desarrollo local rapido (Docker)
1. Copia variables:

```bash
cp .env.example .env
```

2. Levanta todo:

```bash
docker compose up --build
```

3. URLs:
- Frontend: `http://localhost:8100`
- API health: `http://localhost:4000/health`
- API ready: `http://localhost:4000/health/ready`

Credenciales demo (si `RUN_SEED=true`):
- `admin@regismatic.local` / `Regismatic2026!`
- `empleado@regismatic.local` / `Regismatic2026!`

## 2) Desarrollo local sin Docker
Instala dependencias en raiz:

```bash
npm install
```

### Backend
```bash
cp backend/.env.example backend/.env
npm run prisma:generate --workspace backend
npm run prisma:migrate --workspace backend
npm run seed --workspace backend
npm run dev:api
```

### Frontend
En otra terminal:

```bash
cp frontend/.env.example frontend/.env
npm run dev:web
```

## 3) Produccion con TLS (Caddy)
1. Copia plantilla de produccion:

```bash
cp .env.production.example .env.production
```

2. Ajusta minimo:
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `APP_DOMAIN`
- `API_DOMAIN`
- `VITE_API_BASE_URL`
- `RUN_SEED=false`

3. Despliega:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Guia ampliada: [docs/deploy-production.md](docs/deploy-production.md)

## 4) Backups y restore de PostgreSQL
Linux/macOS:
```bash
./scripts/backup-db.sh
./scripts/restore-db.sh ./backups/archivo.sql.gz
```

PowerShell:
```powershell
./scripts/backup-db.ps1
./scripts/restore-db.ps1 -BackupFile .\backups\archivo.sql
```

## 5) Movil (Capacitor)
Desde `frontend/`:

```bash
npm run build
npm run cap:sync
npx cap add android
# o
npx cap add ios
```

## Documentacion adicional
- [Legal + benchmark](docs/legal-and-product-research.md)
- [Despliegue produccion](docs/deploy-production.md)
- [Backend README](backend/README.md)
- [Frontend README](frontend/README.md)

## Aviso
Facilita cumplimiento operativo del registro horario, pero no sustituye asesoramiento legal profesional.
