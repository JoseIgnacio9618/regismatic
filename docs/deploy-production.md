# Despliegue en produccion

Guia para levantar Regismatic con TLS automatico usando Caddy.

## 1. Requisitos
- Servidor Linux con Docker + Docker Compose
- DNS apuntando al servidor:
  - `APP_DOMAIN` (ej: `app.tudominio.com`)
  - `API_DOMAIN` (ej: `api.tudominio.com`)
- Puertos `80` y `443` abiertos

## 2. Configuracion de variables
1. Copia la plantilla:

```bash
cp .env.production.example .env.production
```

2. Edita `.env.production`:

```env
POSTGRES_DB=regismatic
POSTGRES_USER=regismatic
POSTGRES_PASSWORD=<password-fuerte>
JWT_SECRET=<secreto-largo-muy-aleatorio>
JWT_EXPIRES_IN=12h
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=10
FCM_SERVICE_ACCOUNT_PATH=/run/secrets/firebase-service-account.json
RUN_SEED=false
APP_DOMAIN=app.tudominio.com
API_DOMAIN=api.tudominio.com
VITE_API_BASE_URL=https://api.tudominio.com/api
```

## 3. Despliegue

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Comprobaciones:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api
curl https://api.tudominio.com/health
curl https://api.tudominio.com/health/ready
```

## 4. Arquitectura de produccion
- `proxy` (Caddy): termina TLS y enruta por dominio
- `web` (Nginx): sirve frontend Ionic
- `api` (Node): API Express
- `db` (PostgreSQL): persistencia SQL
- `regismatic-uploads` (volumen Docker): fotos de perfil y otros ficheros persistentes del backend

PostgreSQL no se expone publicamente en produccion.

## 5. Backups y restore

### Backup (Linux)
```bash
./scripts/backup-db.sh
```

### Restore (Linux)
```bash
./scripts/restore-db.sh ./backups/regismatic_YYYYMMDD_HHMMSS.sql.gz
```

### Backup (PowerShell)
```powershell
./scripts/backup-db.ps1
```

### Restore (PowerShell)
```powershell
./scripts/restore-db.ps1 -BackupFile .\backups\regismatic_YYYYMMDD_HHMMSS.sql
```

## 6. Operacion recomendada
- Ejecutar backup diario y guardar copia fuera del servidor
- Monitorizar `api`, `db` y renovacion de certificados de Caddy
- Rotar secretos periodicamente (`JWT_SECRET`, credenciales DB)
- Mantener `RUN_SEED=false` fuera de entornos demo
- Restringir acceso admin y exigir contrasenas robustas

## 7. Actualizacion

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

La API aplica `prisma migrate deploy` al arrancar.
