# Regismatic

Aplicacion de control horario para Espana con dos proyectos separados en el mismo repositorio:
- `frontend/`: Ionic Angular (web responsive + base para movil con Capacitor)
- `backend/`: API Express + Prisma + PostgreSQL

La base de datos es **PostgreSQL (SQL)**, no SQLite.

## Resumen rapido
- Monorepo con frontend y backend separados
- Frontend `Ionic Angular`, preparado para web y movil con Capacitor
- Backend `Express + Prisma + PostgreSQL`
- Roles:
  - `EMPLOYEE`
  - `ADMIN`
  - `SUPERADMIN`
- Soporta multiadministrador y equipos separados
- Incluye notificaciones internas y push
- Incluye facturacion por planes con Stripe para admins
- Incluye datos demo basicos y fixtures demo opcionales masivos

## Estructura
- [frontend](frontend)
- [backend](backend)
- [docker-compose.yml](docker-compose.yml): entorno local
- [docker-compose.prod.yml](docker-compose.prod.yml): produccion con TLS (Caddy)
- [infra/caddy/Caddyfile](infra/caddy/Caddyfile)
- [scripts](scripts): backup/restore de base de datos

## Funcionalidades
- Login JWT con roles `SUPERADMIN`, `ADMIN` y `EMPLOYEE`
- Alta publica de administradores desde la propia app (`/register-admin`)
- Facturacion por plan para administradores:
  - `Demo 7 dias / 3 usuarios`
  - `Pack 10` con precio mensual/anual definido en Stripe
  - `Pack 20: 29 EUR/mes`
  - `Pack 50: 59 EUR/mes`
  - `Pack 100: 99 EUR/mes`
  - planes mensual y anual en Stripe
  - checkout y portal de cliente con Stripe
- Alta publica de empleados desde la propia app (`/register-employee`)
- El primer alta publica de administrador se promociona automaticamente a `SUPERADMIN`
- Los admins nuevos arrancan con una demo de 7 dias y 3 usuarios
- La demo publica intenta reutilizar la IP para evitar multicuentas de prueba del mismo origen
- Multiadministrador: cada admin gestiona solo su propia plantilla
- Flujo de incorporacion a equipo por codigo:
  - cada `ADMIN` dispone de su propio codigo de acceso
  - un empleado puede crear su perfil, introducir el codigo y generar una solicitud de union al equipo
  - el `ADMIN` objetivo puede aprobar o rechazar la solicitud
  - el `SUPERADMIN` puede revisarlo todo, ver los codigos de los admins y actuar sin depender de validaciones de terceros
- Fichaje: entrada, pausa inicio/fin, salida
- Trazabilidad de eventos con auditoria de modificaciones (quien y cuando)
- Geolocalizacion opcional por evento
- Ajustes manuales (admin)
- Reportes por rango + export Excel (.xlsx) con hojas de resumen tipo tabla dinamica
- Solicitudes de correccion por parte de empleados
- Revision de solicitudes y edicion directa de registros por administradores
- Centro de incidencias priorizado para admin (arriba en reportes)
- Notificaciones internas en app + push para Android/iOS (FCM)
- Foto de perfil por usuario con avatar por defecto cuando no hay imagen
- Gestion de usuarios por alcance:
  - `ADMIN`: solo crea y gestiona empleados propios
  - `SUPERADMIN`: ve todo, puede crear admins, superadmins y empleados asignados, y reasignar empleados entre administradores
- Carga opcional de fixtures demo masiva para pruebas visuales y funcionales
- Hardening basico de API: CORS configurable, rate limit de login, health checks

## Arquitectura funcional
- `frontend/`
  - interfaz web responsiva
  - soporte movil con Capacitor
  - gestion de tema, idioma, notificaciones y navegacion por rol
- `backend/`
  - autenticacion JWT
  - reglas de negocio de fichaje, incidencias, equipos y notificaciones
  - Prisma como capa de acceso SQL
- `PostgreSQL`
  - persistencia de usuarios, fichajes, solicitudes, notificaciones y tokens push
- `Caddy`
  - proxy reverso TLS en produccion

## Roles y permisos
- `EMPLOYEE`
  - ficha su propia jornada
  - consulta sus registros
  - solicita correcciones
  - puede crear su perfil publicamente
  - puede pedir unirse a un equipo con codigo de administrador
- `ADMIN`
  - gestiona solo su equipo
  - crea empleados directamente
  - su limite de empleados depende del plan activo
  - aprueba o rechaza solicitudes de correccion de su equipo
  - aprueba o rechaza solicitudes de union a su equipo
  - puede modificar registros de su plantilla
- `SUPERADMIN`
  - visibilidad global
  - puede crear `ADMIN`, `SUPERADMIN` y `EMPLOYEE`
  - puede reasignar empleados entre administradores
  - puede revisar cualquier incidencia y cualquier solicitud de union a equipo
  - no depende de validaciones de terceros
  - no queda limitado por planes ni por Stripe

## Flujos principales
- Alta publica de administrador
  - ruta: `/register-admin`
  - el primer administrador registrado pasa a `SUPERADMIN`
- Alta publica de empleado
  - ruta: `/register-employee`
  - puede registrarse con o sin codigo de admin
- Union a equipo por codigo
  - el admin comparte su codigo
  - el empleado crea o usa su perfil
  - se genera una solicitud
  - el admin o superadmin la revisa en `Equipo`
- Gestion de incidencias
  - el empleado solicita correccion en `Reportes`
  - el admin o superadmin la revisa en `Reportes`
- Notificaciones
  - cada notificacion redirige a la pantalla donde se puede actuar sobre ella

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

Si quieres cargar una base muy poblada de pruebas, activa antes en `.env`:

```env
RUN_DEMO_FIXTURES=true
```

3. URLs:
- Frontend: `http://localhost:8100`
- API health: `http://localhost:4000/health`
- API ready: `http://localhost:4000/health/ready`
- Fotos de perfil: se guardan en un volumen Docker independiente del backend

Credenciales demo (si `RUN_SEED=true`):
- `superadmin@regismatic.local` / `Regismatic2026!`
- `admin@regismatic.local` / `Regismatic2026!`
- `empleado@regismatic.local` / `Regismatic2026!`

Tambien puedes crear nuevos administradores desde la pantalla publica:
- `http://localhost:8100/register-admin`

Y tambien nuevos empleados desde:
- `http://localhost:8100/register-employee`

## Datos demo opcionales masivos
Ademas del seed basico, existe una carga opcional de fixtures mucho mas completa pensada para revisar la app con volumen realista:
- varios admins y un superadmin de pruebas
- decenas de empleados
- varias semanas de fichajes
- ajustes manuales
- solicitudes de correccion pendientes, aprobadas y rechazadas
- solicitudes de union a equipo pendientes, aprobadas y rechazadas
- notificaciones asociadas

No se ejecuta sola salvo que la invoques expresamente o actives `RUN_DEMO_FIXTURES=true` en Docker.

Ejecucion manual:

```bash
npm run seed:fixtures
```

Caracteristicas:
- es reejecutable
- antes de recrear los fixtures, elimina los fixtures anteriores
- solo toca usuarios del dominio `@fixtures.regismatic.local`
- no sustituye al seed basico; lo complementa

Credencial comun de fixtures:
- `Regismatic2026!`

Ejemplos:
- `superadmin.fixture@fixtures.regismatic.local`
- `admin1.fixture@fixtures.regismatic.local`
- `empleado-1-1@fixtures.regismatic.local`
- `pendiente-1@fixtures.regismatic.local`

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
# opcional:
npm run seed:fixtures --workspace backend
npm run dev:api
```

Variables principales de backend:
- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `PORT`
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
En otra terminal:

```bash
cp frontend/.env.example frontend/.env
npm run dev:web
```

Notas:
- `npm run dev:web` usa `ionic serve`
- el frontend queda en `http://localhost:8100`
- el backend queda en `http://localhost:4000`
- si usas PostgreSQL por Docker del proyecto, el puerto publicado local es `5433`

Flujo recomendado para probar el alta libre de empleados:
1. Entra como `admin@regismatic.local` o `superadmin@regismatic.local`
2. Ve a `Equipo` y copia el codigo de acceso del equipo
3. Cierra sesion y entra en `http://localhost:8100/register-employee`
4. Crea el perfil del empleado introduciendo ese codigo
5. Vuelve a entrar como admin para aprobar o rechazar la solicitud pendiente

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

3. Despliega:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Guia ampliada: [docs/deploy-production.md](docs/deploy-production.md)

## 3.1) Stripe Billing
- La integracion usa `Stripe Checkout` para contratar/cambiar plan y `Customer Portal` para gestionar el cobro.
- No hace falta clave publica en el frontend porque la redireccion a Stripe se crea desde backend.
- Claves/IDs que debes configurar:
  - `STRIPE_SECRET_KEY`: clave secreta de tu cuenta Stripe
  - `STRIPE_WEBHOOK_SECRET`: secreto del endpoint webhook de Stripe
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
- El webhook del backend escucha en:
  - `POST /api/billing/webhook`
- En local puedes probarlo con Stripe CLI:

```bash
stripe listen --forward-to http://localhost:4000/api/billing/webhook
```

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

Para push nativo Android/iOS (opcional pero recomendado):
- Configura Firebase Cloud Messaging y define en backend:
  - `FCM_SERVICE_ACCOUNT_JSON` (json completo en una linea), o
  - `FCM_SERVICE_ACCOUNT_PATH` (ruta al json de service account).
- Tras configurar, sincroniza plataformas:

```bash
cd frontend
npm run cap:sync
```

## 6) Fotos de perfil
- Cada usuario puede subir o quitar su propia foto desde el menu de cuenta.
- `ADMIN` y `SUPERADMIN` tambien pueden gestionar la foto de los usuarios visibles en `Equipo`.
- Si no existe imagen, la app muestra un avatar por iniciales.
- Formatos admitidos: `JPG`, `PNG`, `WEBP`, `GIF`
- Tamano maximo en API: `512 KB`
- La app recorta y comprime la foto antes de subirla para dejarla ligera
- En Docker las imagenes quedan persistidas en el volumen `regismatic-uploads`.

## 7) Datos demo y fixtures
- `npm run seed`
  - carga el seed basico
  - crea cuentas demo minimas para empezar rapido
- `npm run seed:fixtures`
  - carga fixtures masivos y reejecutables
  - util para demos, QA visual y pruebas de flujos
- `RUN_SEED`
  - controla si Docker ejecuta el seed basico al arrancar la API
- `RUN_DEMO_FIXTURES`
  - controla si Docker ejecuta tambien los fixtures masivos

## 8) Notas operativas
- Las notificaciones de la app y push redirigen a la pantalla donde se gestionan
- Las fotos de perfil se guardan en disco del backend y se sirven mediante endpoint autenticado de la API
- En produccion PostgreSQL no se expone publicamente
- La API aplica `prisma migrate deploy` al arrancar en Docker

## 9) Solucion de problemas rapida
- `ionic serve` no conecta con backend
  - verifica `http://localhost:4000/health`
- login o peticiones fallan por base de datos
  - comprueba que PostgreSQL este accesible y que `DATABASE_URL` sea correcta
- las fotos no se ven
  - revisa que el backend este levantado y que la sesion siga siendo valida para cargar recursos protegidos
- push no funciona
  - revisa configuracion FCM y sincronizacion de Capacitor
- quieres poblar muchos datos de prueba
  - ejecuta `npm run seed:fixtures`

## Documentacion adicional
- [Legal + benchmark](docs/legal-and-product-research.md)
- [Despliegue produccion](docs/deploy-production.md)
- [Checklist aislamiento de sesion](docs/session-isolation-checklist.md)
- [Backend README](backend/README.md)
- [Frontend README](frontend/README.md)

## Aviso
Facilita cumplimiento operativo del registro horario, pero no sustituye asesoramiento legal profesional.
