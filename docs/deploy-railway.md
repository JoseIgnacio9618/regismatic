# Despliegue completo de Regismatic en Railway

Fecha de la guia: 2026-03-25

Esta guia esta pensada para desplegar **todo lo necesario** de Regismatic en Railway con el estado actual del proyecto.

Si prefieres una version guiada, muy detallada y pensada para seguirla sin experiencia previa en Railway, usa primero:
- [deploy-railway-paso-a-paso.md](./deploy-railway-paso-a-paso.md)

Objetivo de la guia:

- no dejar variables importantes fuera
- no dejar pasos de Railway sin cubrir
- no prometer un escalado que la app hoy aun no soporta bien
- dejar claro que puedes escalar automaticamente **con control de coste**

## 1. Resumen rapido

Para desplegar Regismatic en Railway hoy necesitas, como minimo:

1. una cuenta de Railway
2. el repositorio en GitHub
3. un servicio `PostgreSQL`
4. un servicio `API` para `backend/`
5. un servicio `Web` para `frontend/`
6. un volumen para las fotos de perfil **si no cambias el sistema actual de almacenamiento**
7. un dominio o subdominios para:
   - `app.tudominio.com`
   - `api.tudominio.com`
8. Stripe configurado
9. FCM configurado si quieres notificaciones push reales en movil

## 2. Limitacion tecnica importante antes de empezar

Regismatic **si puede desplegarse hoy en Railway**, pero debes tener en cuenta esto:

- actualmente las fotos de perfil se guardan en disco local del backend
- en Railway eso implica adjuntar un volumen al servicio `API`
- un servicio con volumen es valido para persistencia, pero no es la mejor base para replicas horizontales limpias

### Conclusiones practicas

Con el codigo actual:

- `frontend`: puede escalar sin problema
- `backend/API`: puede escalar **verticalmente** bien
- `backend/API`: no te recomiendo replicas horizontales reales mientras las fotos sigan en filesystem local
- `PostgreSQL`: ira como servicio gestionado dentro del proyecto Railway

Si mas adelante mueves fotos a un bucket S3-compatible, entonces si tendras una base mucho mejor para replicas del backend.

## 3. Arquitectura recomendada en Railway para el proyecto actual

### Servicio 1: `postgres`
- servicio PostgreSQL de Railway
- no exponer publicamente
- usado solo por el backend via red privada de Railway

### Servicio 2: `api`
- desplegado desde `backend/`
- usa Dockerfile
- lleva migraciones automaticas al arrancar
- puede usar volumen para `uploads`
- expone dominio publico para la API

### Servicio 3: `web`
- desplegado desde `frontend/`
- usa Dockerfile
- genera el build Angular y lo sirve con Nginx
- expone dominio publico para la app

### Persistencia adicional
- volumen Railway en el servicio `api`
- ruta de montaje recomendada para este proyecto: `/usr/src/app/uploads`

## 4. Requisitos previos

Antes de tocar Railway, asegúrate de tener:

- cuenta en Railway
- cuenta en GitHub con el repo actualizado
- dominio propio o subdominios disponibles
- cuenta de Stripe con tus `price_...` creados
- cuenta/proyecto Firebase con service account si quieres push

### Requisito importante del plan

Railway documenta que el **Trial Plan** esta limitado a `1 custom domain`.

Como Regismatic normalmente necesita al menos:

- `app.tudominio.com`
- `api.tudominio.com`

lo razonable es usar como minimo un plan que te permita trabajar con ambos dominios sin esa limitacion.

Fuente oficial:
- https://docs.railway.com/networking/domains/working-with-domains

## 5. Preparacion del repositorio

Asegurate de que en GitHub esta el estado correcto del proyecto.

En este repo, Railway puede desplegar cada servicio apuntando a una subcarpeta:

- backend -> `backend/`
- frontend -> `frontend/`

Eso te evita inventos raros con un solo servicio para todo.

## 6. Preparacion de Stripe

Antes del despliegue necesitas en Stripe:

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

Ademas, debes decidir estas URLs:

- `STRIPE_CHECKOUT_SUCCESS_URL`
- `STRIPE_CHECKOUT_CANCEL_URL`
- `STRIPE_BILLING_PORTAL_RETURN_URL`

Ejemplo:

- `https://app.tudominio.com/billing?checkout=success`
- `https://app.tudominio.com/billing?checkout=cancel`
- `https://app.tudominio.com/billing`

Tambien necesitas crear en Stripe el webhook apuntando a:

```text
https://api.tudominio.com/api/billing/webhook
```

Eventos minimos:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Si necesitas el checklist mas fino de Stripe, ya lo tienes separado en:
- [CONFIGURACION_STRIPE.md](../CONFIGURACION_STRIPE.md)

## 7. Preparacion de Firebase Cloud Messaging

Si quieres push reales para Android/iOS:

- crea o reutiliza un proyecto de Firebase
- genera una service account
- usa preferiblemente `FCM_SERVICE_ACCOUNT_JSON` en Railway

### Recomendacion

En Railway es mas comodo guardar el JSON completo en una variable sellada:

- `FCM_SERVICE_ACCOUNT_JSON`

que intentar montar un archivo local.

## 8. Crear el proyecto en Railway

### Opcion GUI

1. Entra en Railway
2. Crea un proyecto nuevo
3. Conecta tu repositorio de GitHub
4. Trabaja en el entorno `production`

### Opcion CLI

Instalacion del CLI:
- https://docs.railway.com/cli

Comandos habituales:

```bash
npm install -g @railway/cli
railway login
```

## 9. Crear el servicio PostgreSQL

1. En el canvas del proyecto, crea un servicio `PostgreSQL`
2. Ponle un nombre claro, por ejemplo:
   - `postgres`
3. No hace falta exponerlo publicamente
4. Usa la red privada de Railway

### Variable importante para el backend

El backend necesitara un `DATABASE_URL` enlazado al servicio `postgres`.

Railway soporta referencias entre servicios mediante variables.

Ejemplo tipico:

```text
DATABASE_URL=${{postgres.DATABASE_URL}}
```

Si el servicio tiene otro nombre, cambia `postgres` por el nombre real.

Fuente oficial sobre entornos y referencias:
- https://docs.railway.com/develop/environments

## 10. Crear el servicio `api`

### 10.1. Fuente y builder

1. Crea un servicio nuevo desde el repo GitHub
2. Haz que apunte a la carpeta `backend/`
3. Builder: `Dockerfile`
4. Como el Dockerfile esta en la raiz de `backend/`, no necesitas una ruta rara si el root del servicio es `backend/`

Si en tu configuracion el root no fuera `backend/`, entonces usa:

```text
RAILWAY_DOCKERFILE_PATH=backend/Dockerfile
```

Fuente oficial:
- https://docs.railway.com/reference/dockerfiles

### 10.2. Healthcheck

Configura el healthcheck del servicio `api` como:

```text
/health/ready
```

Esto es mejor que `/health` porque el backend solo dara OK cuando Prisma y la base de datos esten realmente listos.

### 10.3. Variables del servicio `api`

Pon estas variables en el servicio `api`.

#### Obligatorias

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=${{postgres.DATABASE_URL}}
JWT_SECRET=<secreto-muy-largo-y-aleatorio>
JWT_EXPIRES_IN=12h
CORS_ORIGIN=https://app.tudominio.com
TRUST_PROXY=true
JSON_BODY_LIMIT=256kb
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX=240
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=10
BILLING_TRIAL_DAYS=7
BILLING_TRIAL_SEAT_LIMIT=3
BILLING_TRIAL_IP_ENFORCEMENT=true
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PACK_10_MONTHLY=price_xxx
STRIPE_PRICE_PACK_10_YEARLY=price_xxx
STRIPE_PRICE_PACK_20_MONTHLY=price_xxx
STRIPE_PRICE_PACK_20_YEARLY=price_xxx
STRIPE_PRICE_PACK_50_MONTHLY=price_xxx
STRIPE_PRICE_PACK_50_YEARLY=price_xxx
STRIPE_PRICE_PACK_100_MONTHLY=price_xxx
STRIPE_PRICE_PACK_100_YEARLY=price_xxx
STRIPE_CHECKOUT_SUCCESS_URL=https://app.tudominio.com/billing?checkout=success
STRIPE_CHECKOUT_CANCEL_URL=https://app.tudominio.com/billing?checkout=cancel
STRIPE_BILLING_PORTAL_RETURN_URL=https://app.tudominio.com/billing
RUN_SEED=false
RUN_DEMO_FIXTURES=false
```

#### Push opcional

```env
FCM_SERVICE_ACCOUNT_JSON={...json completo de la service account...}
```

### 10.4. Variables recomendadas

Si quieres una operacion mas comoda:

```env
RAILWAY_HEALTHCHECK_TIMEOUT_SEC=300
RAILWAY_DEPLOYMENT_OVERLAP_SECONDS=20
RAILWAY_DEPLOYMENT_DRAINING_SECONDS=30
```

Fuente oficial de variables de configuracion Railway:
- https://docs.railway.com/reference/variables

### 10.5. Volumen para fotos

Como la app hoy guarda fotos en filesystem local, crea un volumen y montalo en:

```text
/usr/src/app/uploads
```

No montes `/app/uploads`, porque este proyecto en runtime trabaja en:

```text
/usr/src/app
```

Fuente oficial sobre volumenes:
- https://docs.railway.com/guides/volumes

### 10.6. Dominio del servicio `api`

1. Primero genera un dominio Railway para probar
2. Luego añade el dominio real:
   - `api.tudominio.com`
3. En tu proveedor DNS crea el `CNAME` que te indique Railway
4. Espera la validacion y el certificado SSL automatico

Fuente oficial:
- https://docs.railway.com/networking/domains/working-with-domains

### 10.7. Endpoints WebSocket de estado

Los servicios `api` y `web` exponen un WebSocket en `/status`. Con los dominios
publicos quedaran disponibles, por ejemplo, en:

```text
wss://api.tudominio.com/status
wss://app.tudominio.com/status
```

El API tambien admite `wss://api.tudominio.com/api/status`, para poder
registrar directamente su URL base habitual terminada en `/api`.

No requieren un puerto, volumen ni variable adicional: Railway publica el mismo
`PORT` de cada servicio y admite el upgrade WebSocket.

## 11. Crear el servicio `web`

### 11.1. Fuente y builder

1. Crea otro servicio desde el mismo repo GitHub
2. Haz que apunte a la carpeta `frontend/`
3. Builder: `Dockerfile`

### 11.2. Variable obligatoria del frontend

El frontend necesita esta variable:

```env
VITE_API_BASE_URL=https://api.tudominio.com/api
```

Importante:

- Railway indica que las variables que quieras usar en Docker build deben declararse con `ARG` en el Dockerfile
- el Dockerfile de este proyecto ya usa `ARG VITE_API_BASE_URL`
- por eso esta variable se puede inyectar al build del frontend

Fuente oficial:
- https://docs.railway.com/reference/dockerfiles

### 11.3. Dominio del servicio `web`

1. Genera dominio Railway para pruebas
2. Cuando funcione, añade:
   - `app.tudominio.com`
3. Configura el `CNAME` en DNS
4. Espera la validacion SSL

## 12. Orden correcto del primer despliegue

Para evitar errores de dominio, CORS o Stripe, yo lo haria asi:

1. crear `postgres`
2. crear `api`
3. poner variables del backend
4. desplegar `api`
5. comprobar:
   - `https://<tu-api-temporal>/health`
   - `https://<tu-api-temporal>/health/ready`
6. crear `web`
7. poner `VITE_API_BASE_URL` apuntando a la URL temporal del API o ya al dominio final si ya lo tienes
8. desplegar `web`
9. probar login y navegacion basica
10. configurar dominios finales
11. actualizar `CORS_ORIGIN` si hace falta
12. configurar Stripe webhook final
13. probar facturacion
14. activar FCM si lo vas a usar

## 13. Semillas y datos demo

El `docker-entrypoint.sh` del backend hace esto al arrancar:

1. `prisma migrate deploy`
2. si `RUN_SEED=true` -> ejecuta seed
3. si `RUN_DEMO_FIXTURES=true` -> ejecuta fixtures
4. levanta `node dist/index.js`

### Recomendacion fuerte

En produccion real:

```env
RUN_SEED=false
RUN_DEMO_FIXTURES=false
```

Si necesitas seed inicial, hazlo una sola vez en una primera subida controlada y luego vuelve esas variables a `false`.

## 14. Autoescalado y topes de coste

Tu prioridad es esta, asi que te dejo una propuesta operativa concreta.

### Lo que si puedes hacer hoy

- activar autoescalado del servicio `api`
- dejar el frontend como servicio aparte
- controlar el gasto con el plan y el consumo de Railway
- fijar limites operativos del despliegue

### Lo que no te recomiendo hoy

- replicas horizontales agresivas del backend mientras las fotos sigan en volumen local

### Configuracion operativa recomendada

1. activa autoescalado del `api`
2. empieza con limites conservadores
3. revisa uso real una semana
4. sube topes solo cuando los necesites
5. mantén alertas de coste

### Regla practica para este proyecto

- `frontend`: sin problema
- `api`: autoescalado vertical si
- `api`: replicas multiples solo cuando las fotos salgan del disco local
- `db`: vigilar CPU, RAM y conexiones antes de tocar la API a lo loco

## 15. CORS correcto para Railway

Cuando tengas dominio final:

```env
CORS_ORIGIN=https://app.tudominio.com
```

Si durante la transicion quieres aceptar tambien el dominio Railway del frontend:

```env
CORS_ORIGIN=https://app.tudominio.com,https://tu-web.up.railway.app
```

## 16. Railway Domains y DNS

### Recomendacion practica

Mientras montas todo:

- usa primero dominios Railway
- valida que la app funciona
- despues conecta `app.tudominio.com` y `api.tudominio.com`

### Si usas Cloudflare

Railway documenta dos puntos importantes:

- si usas proxy de Cloudflare, configura SSL/TLS en `Full`
- con dominios mas profundos que primer subdominio puede haber limitaciones si no tienes Advanced Certificate Manager

Fuente oficial:
- https://docs.railway.com/networking/domains/working-with-domains

## 17. Comprobaciones despues del despliegue

### Backend

Prueba:

```bash
curl https://api.tudominio.com/health
curl https://api.tudominio.com/health/ready
```

### Frontend

Comprueba:

- carga inicial
- login
- dashboard
- logout
- cambio de idioma
- modo oscuro

### Flujo funcional minimo

Prueba al menos:

1. login con admin
2. crear empleado
3. fichar
4. generar reporte
5. descargar Excel
6. Stripe checkout
7. webhook de Stripe
8. notificaciones internas
9. subida de foto

## 18. Backups

### Fotos

Si mantienes volumen en `api`, configura backups del volumen desde Railway.

Railway documenta backups programables de volumen:
- diarios
- semanales
- mensuales

Fuente oficial:
- https://docs.railway.com/reference/backups

### Base de datos

Aunque uses Railway PostgreSQL, mi recomendacion es no depender solo de la plataforma:

- exporta `pg_dump` periodicamente
- guarda copia fuera de Railway

## 19. Observabilidad y soporte operativo minimo

Como minimo revisa:

- logs del servicio `api`
- logs del servicio `web`
- estado de `postgres`
- healthcheck `/health/ready`
- errores de Stripe webhook
- consumo de recursos y coste

## 20. Problemas tipicos en Railway para este proyecto

### La app carga pero el frontend llama a `localhost`

Causa habitual:
- `VITE_API_BASE_URL` mal puesto o build antiguo

Solucion:
- revisa la variable del servicio `web`
- fuerza redeploy del frontend

### Error de CORS al hacer login

Causa habitual:
- `CORS_ORIGIN` no incluye el dominio real del frontend

Solucion:
- añade el dominio correcto en `api`
- redeploy del backend

### Stripe no actualiza la suscripcion

Causa habitual:
- webhook mal configurado
- secreto incorrecto
- eventos incompletos

Solucion:
- revisa `STRIPE_WEBHOOK_SECRET`
- revisa el endpoint
- revisa los eventos configurados

### Las fotos se pierden o no aparecen

Causa habitual:
- no hay volumen montado en `/usr/src/app/uploads`

Solucion:
- crea y monta el volumen en esa ruta exacta

### El backend entra en bucle al arrancar

Causa habitual:
- `DATABASE_URL` mal enlazado
- migraciones fallando

Solucion:
- revisa `DATABASE_URL=${{postgres.DATABASE_URL}}`
- revisa logs del deploy

## 21. Recomendacion final para Railway con el estado actual del proyecto

Si quieres desplegar Regismatic hoy en Railway y hacerlo bien:

1. `postgres` en Railway
2. `api` en Railway con autoescalado y volumen para fotos
3. `web` en Railway con `VITE_API_BASE_URL` correcta
4. dominios separados `app` y `api`
5. Stripe y FCM configurados desde variables selladas
6. backups y alertas desde el primer dia
7. no meter replicas horizontales reales del backend hasta sacar fotos a bucket S3-compatible

## 22. Fuentes oficiales usadas

- Railway docs home: https://docs.railway.com/
- Dockerfiles: https://docs.railway.com/reference/dockerfiles
- Variables: https://docs.railway.com/develop/variables
- Variable references / environments: https://docs.railway.com/develop/environments
- Domains: https://docs.railway.com/networking/domains/working-with-domains
- Public networking: https://docs.railway.com/deploy/exposing-your-app
- Volumes: https://docs.railway.com/guides/volumes
- Backups: https://docs.railway.com/reference/backups
- Private networking runtime/build note: https://docs.railway.com/networking/private-networking/how-it-works
- Pricing: https://docs.railway.com/pricing
- Static hosting guide: https://docs.railway.com/guides/static-hosting
- Autoscaling guide for Express: https://docs.railway.com/guides/deploy-node-express-api-with-auto-scaling-secrets-and-zero-downtime
