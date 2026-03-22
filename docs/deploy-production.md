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
RUN_DEMO_FIXTURES=false
APP_DOMAIN=app.tudominio.com
API_DOMAIN=api.tudominio.com
VITE_API_BASE_URL=https://api.tudominio.com/api
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PACK_10_MONTHLY=price_xxx
STRIPE_PRICE_PACK_20_MONTHLY=price_xxx
STRIPE_PRICE_PACK_50_MONTHLY=price_xxx
STRIPE_PRICE_PACK_100_MONTHLY=price_xxx
STRIPE_CHECKOUT_SUCCESS_URL=https://app.tudominio.com/billing?checkout=success
STRIPE_CHECKOUT_CANCEL_URL=https://app.tudominio.com/billing?checkout=cancel
STRIPE_BILLING_PORTAL_RETURN_URL=https://app.tudominio.com/billing
```

Notas:
- manten `RUN_SEED=false` salvo despliegues demo controlados
- manten `RUN_DEMO_FIXTURES=false` en produccion real
- si vas a usar push, define `FCM_SERVICE_ACCOUNT_JSON` o `FCM_SERVICE_ACCOUNT_PATH`
- Stripe en esta integracion no necesita clave publica en frontend porque Checkout y Customer Portal se abren desde sesiones generadas por backend
- si tu app esta detras de proxy, deja `TRUST_PROXY=true` para que la IP de demo y los rate limits funcionen bien

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

## 3.1. Configuracion de Stripe
1. Crea en Stripe cuatro precios recurrentes mensuales:
   - Pack 10 -> `19 EUR/mes`
   - Pack 20 -> `29 EUR/mes`
   - Pack 50 -> `59 EUR/mes`
   - Pack 100 -> `99 EUR/mes`
2. Copia sus `price_...` en:
   - `STRIPE_PRICE_PACK_10_MONTHLY`
   - `STRIPE_PRICE_PACK_20_MONTHLY`
   - `STRIPE_PRICE_PACK_50_MONTHLY`
   - `STRIPE_PRICE_PACK_100_MONTHLY`
3. Crea un endpoint webhook apuntando a:

```text
https://api.tudominio.com/api/billing/webhook
```

4. Escucha al menos estos eventos:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copia el secreto del webhook en `STRIPE_WEBHOOK_SECRET`

Resultado:
- los admins nuevos arrancan con demo de `7 dias / 10 usuarios`
- al contratar o cambiar plan, Stripe actualiza el backend por webhook
- el limite de empleados se aplica tanto al crear empleados como al aceptar solicitudes de union al equipo

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
- Monitorizar tambien los webhooks de Stripe y los intentos fallidos en Dashboard
- Rotar secretos periodicamente (`JWT_SECRET`, credenciales DB)
- Proteger `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` igual que el resto de secretos del entorno
- Mantener `RUN_SEED=false` fuera de entornos demo
- Mantener `RUN_DEMO_FIXTURES=false` fuera de entornos demo
- Restringir acceso admin y exigir contrasenas robustas

## 7. Actualizacion

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

La API aplica `prisma migrate deploy` al arrancar.
