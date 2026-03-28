# Railway paso a paso para llevar Regismatic a produccion

Fecha de la guia: 2026-03-28

Esta guia esta escrita como si no supieras nada de Railway. La idea es que puedas abrir Railway e ir siguiendo pasos uno por uno sin perderte.

Usa esta guia junto con:
- [deploy-railway.md](./deploy-railway.md): explicacion tecnica completa
- [CONFIGURACION_STRIPE.md](../CONFIGURACION_STRIPE.md): parte detallada de Stripe

## 0. Que vamos a montar exactamente

Al terminar esta guia tendras esto funcionando:

- una base de datos PostgreSQL en Railway
- un backend `api` de Regismatic en Railway
- un frontend `web` de Regismatic en Railway
- dos dominios:
  - `app.tudominio.com`
  - `api.tudominio.com`
- Stripe conectado
- volumen para las fotos del backend

## 1. Lo que tienes que tener preparado antes de entrar en Railway

Antes de empezar, ten a mano estas 5 cosas:

### 1. Cuenta de Railway
Si no la tienes:
- entra en https://railway.com/
- registrate
- conecta tu cuenta de GitHub

### 2. Repositorio en GitHub
Tu proyecto tiene que estar en GitHub porque Railway va a desplegar desde ahi.

Debes tener ya subido este repo con estos directorios:
- `backend/`
- `frontend/`

### 3. Dominio
Necesitas un dominio o subdominios para usar luego algo tipo:
- `app.tudominio.com`
- `api.tudominio.com`

Si aun no tienes dominio, puedes hacer primero todo con los dominios temporales de Railway y conectar el dominio real al final.

### 4. Datos de Stripe
Necesitas tener preparados:
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

Si no los tienes, para aqui y sigue antes:
- [CONFIGURACION_STRIPE.md](../CONFIGURACION_STRIPE.md)

### 5. Firebase para push
Solo si quieres notificaciones push reales en movil.

Necesitas:
- una service account JSON de Firebase

La meteremos en Railway como:
- `FCM_SERVICE_ACCOUNT_JSON`

## 2. Crea el proyecto en Railway

### Paso 2.1
Entra en Railway y pulsa:
- `New Project`

### Paso 2.2
Elige:
- `Empty Project`

Hazlo asi porque vamos a crear los servicios uno a uno y es mas claro.

### Paso 2.3
Ponle un nombre al proyecto. Por ejemplo:
- `regismatic-production`

Cuando termines, veras un canvas vacio.

## 3. Crea la base de datos PostgreSQL

### Paso 3.1
Dentro del proyecto, pulsa:
- `New`
- `Database`
- `Add PostgreSQL`

### Paso 3.2
Cuando se cree, cambia el nombre del servicio a:
- `postgres`

Esto es importante para que luego la referencia del `DATABASE_URL` sea facil de entender.

### Paso 3.3
No expongas la base de datos publicamente.

No necesitas tocar nada de dominios aqui.

### Paso 3.4
Espera a que el servicio salga como listo.

Cuando este listo, ya puedes seguir.

## 4. Crea el servicio del backend

### Paso 4.1
En el proyecto, pulsa:
- `New`
- `GitHub Repo`

### Paso 4.2
Selecciona tu repositorio de Regismatic.

### Paso 4.3
Cuando Railway te pregunte por la configuracion del servicio, haz que este servicio use:
- la carpeta `backend/`

Si Railway te deja indicar el `Root Directory`, pon:

```text
backend
```

### Paso 4.4
Ponle como nombre al servicio:
- `api`

### Paso 4.5
Deja que use el `Dockerfile` de `backend/`.

No hace falta inventar comandos manuales. El backend ya tiene Dockerfile y entrypoint preparados.

## 5. Configura las variables del backend

Ahora entra en el servicio `api` y busca el apartado:
- `Variables`

Vas a crear estas variables una por una.

## 5.1. Variables basicas del backend

Copia exactamente esto, cambiando solo los valores que corresponda:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=${{postgres.DATABASE_URL}}
JWT_SECRET=pon_aqui_un_secreto_muy_largo_y_muy_aleatorio
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
RUN_SEED=false
RUN_DEMO_FIXTURES=false
```

### Muy importante con `DATABASE_URL`

No escribas una URL manual a mano si no hace falta.

Usa la referencia al servicio `postgres`:

```env
DATABASE_URL=${{postgres.DATABASE_URL}}
```

Eso hace que Railway conecte el backend a la base de datos del mismo proyecto.

## 5.2. Variables de Stripe del backend

Añade estas tambien en el servicio `api`:

```env
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
```

## 5.3. Variable opcional de Firebase

Solo si quieres push:

```env
FCM_SERVICE_ACCOUNT_JSON={...pega aqui el JSON completo...}
```

Consejo:
- pega el JSON en una sola variable
- no intentes montar un archivo manual si no hace falta

## 5.4. Variables recomendadas de Railway para el backend

Añade tambien estas tres:

```env
RAILWAY_HEALTHCHECK_TIMEOUT_SEC=300
RAILWAY_DEPLOYMENT_OVERLAP_SECONDS=20
RAILWAY_DEPLOYMENT_DRAINING_SECONDS=30
```

No son obligatorias para que funcione, pero ayudan a que el despliegue sea mas fino.

## 6. Configura el volumen para las fotos del backend

Esto es muy importante en Regismatic.

Si no montas este volumen, las fotos de perfil podran perderse al redesplegar.

### Paso 6.1
Dentro del servicio `api`, busca:
- `Volumes`
- o `Add Volume`

### Paso 6.2
Crea un volumen nuevo.

### Paso 6.3
Montalo exactamente en esta ruta:

```text
/usr/src/app/uploads
```

No uses:

```text
/app/uploads
```

porque el backend de este proyecto no trabaja en `/app`, sino en `/usr/src/app`.

## 7. Configura el healthcheck del backend

Dentro del servicio `api`, busca el apartado de `Healthcheck`.

Pon esta ruta:

```text
/health/ready
```

No pongas `/health` si quieres una comprobacion mas real. `ready` comprueba mejor que la base de datos este disponible.

## 8. Haz el primer despliegue del backend

### Paso 8.1
Una vez metidas las variables y el volumen, deja que Railway haga el deploy.

### Paso 8.2
Espera a que el servicio salga en estado sano.

### Paso 8.3
Mira los logs del servicio `api`.

Debes ver algo compatible con esto:
- migraciones aplicadas
- arranque normal de Node
- sin errores de Prisma

### Paso 8.4
Prueba el backend con el dominio temporal de Railway.

Abre en el navegador o prueba con `curl`:

```text
https://tu-api-temporal.up.railway.app/health
https://tu-api-temporal.up.railway.app/health/ready
```

Si ambos responden bien, seguimos.

## 9. Crea el servicio del frontend

### Paso 9.1
Dentro del proyecto Railway, pulsa otra vez:
- `New`
- `GitHub Repo`

### Paso 9.2
Selecciona otra vez el mismo repositorio.

### Paso 9.3
Haz que este servicio use:
- la carpeta `frontend/`

Si Railway te deja indicar `Root Directory`, pon:

```text
frontend
```

### Paso 9.4
Ponle como nombre:
- `web`

### Paso 9.5
Deja que use el `Dockerfile` de `frontend/`.

## 10. Configura la variable del frontend

Ahora entra en el servicio `web` y abre `Variables`.

Añade esta variable:

```env
VITE_API_BASE_URL=https://tu-api-temporal.up.railway.app/api
```

De momento usa la URL temporal del backend. Mas adelante la cambiaremos al dominio final.

### Importante

El frontend necesita esta variable en build.

Este proyecto ya esta preparado para eso porque su Dockerfile usa:

```dockerfile
ARG VITE_API_BASE_URL
```

Asi que Railway puede inyectarla al construir la app.

## 11. Haz el primer despliegue del frontend

### Paso 11.1
Deja que Railway despliegue `web`.

### Paso 11.2
Cuando termine, abre la URL temporal del frontend.

Debe cargarse la app.

### Paso 11.3
Prueba al menos esto:

- que carga la pantalla de login
- que no hay errores de CORS
- que puedes hacer login
- que el dashboard abre

Si aqui falla el login con error de CORS, vuelve al servicio `api` y revisa:

```env
CORS_ORIGIN=https://tu-web-temporal.up.railway.app
```

Si quieres aceptar varias URLs a la vez, separalas por comas:

```env
CORS_ORIGIN=https://tu-web-temporal.up.railway.app,https://app.tudominio.com
```

## 12. Conecta los dominios reales

Ahora que ya funciona con dominios temporales, ponemos los buenos.

## 12.1. Dominio del backend

En el servicio `api`:

1. entra en `Networking`
2. pulsa `Custom Domain`
3. añade:

```text
api.tudominio.com
```

4. Railway te dira el registro DNS que debes crear
5. ve a tu proveedor de dominio y crea ese `CNAME`
6. espera a que Railway lo valide

## 12.2. Dominio del frontend

En el servicio `web`:

1. entra en `Networking`
2. pulsa `Custom Domain`
3. añade:

```text
app.tudominio.com
```

4. crea el `CNAME` que te indique Railway
5. espera a la validacion

## 12.3. Cambia la URL del frontend al dominio final del backend

Vuelve al servicio `web` y cambia:

```env
VITE_API_BASE_URL=https://tu-api-temporal.up.railway.app/api
```

por:

```env
VITE_API_BASE_URL=https://api.tudominio.com/api
```

Luego fuerza un redeploy del servicio `web`.

## 12.4. Ajusta CORS en el backend al dominio final

Vuelve al servicio `api` y deja:

```env
CORS_ORIGIN=https://app.tudominio.com
```

Si quieres mantener temporalmente tambien la URL Railway del frontend, puedes dejar ambas:

```env
CORS_ORIGIN=https://app.tudominio.com,https://tu-web-temporal.up.railway.app
```

## 13. Configura Stripe ya con dominios finales

Cuando `app.tudominio.com` y `api.tudominio.com` ya funcionen:

### Paso 13.1
En Stripe crea o actualiza el webhook final a:

```text
https://api.tudominio.com/api/billing/webhook
```

### Paso 13.2
Revisa que tienes seleccionados estos eventos:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

### Paso 13.3
Copia el `whsec_...` real de ese webhook y pegalo en Railway en la variable:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Paso 13.4
Comprueba que estas tres URLs en el backend apuntan al dominio final del frontend:

```env
STRIPE_CHECKOUT_SUCCESS_URL=https://app.tudominio.com/billing?checkout=success
STRIPE_CHECKOUT_CANCEL_URL=https://app.tudominio.com/billing?checkout=cancel
STRIPE_BILLING_PORTAL_RETURN_URL=https://app.tudominio.com/billing
```

## 14. Configura Firebase si vas a usar push

Solo si quieres push reales:

### Paso 14.1
En el servicio `api`, pega tu JSON en:

```env
FCM_SERVICE_ACCOUNT_JSON={...json...}
```

### Paso 14.2
Haz redeploy del backend.

### Paso 14.3
Comprueba luego desde la app que el registro de tokens y las notificaciones funcionan.

## 15. Como hacer el primer seed si lo necesitas

En produccion real, lo normal es dejar:

```env
RUN_SEED=false
RUN_DEMO_FIXTURES=false
```

Pero si quieres meter datos iniciales una sola vez:

### Paso 15.1
Pon temporalmente en `api`:

```env
RUN_SEED=true
```

### Paso 15.2
Haz redeploy del backend.

### Paso 15.3
Cuando acabe, vuelve inmediatamente a:

```env
RUN_SEED=false
```

### Paso 15.4
Haz otro redeploy.

No dejes `RUN_SEED=true` para siempre, porque el backend lo intentaria ejecutar en cada despliegue.

## 16. Como poner un tope para que no se dispare el gasto

Tu prioridad era esta, asi que haz esto desde el principio.

### Paso 16.1
En Railway, activa el control de gasto o revisa el limite de tu plan.

### Paso 16.2
Pon alertas internas para revisar el consumo.

### Paso 16.3
No subas de golpe los recursos del `api`.

Empieza con algo prudente y sube solo cuando veas necesidad real.

### Paso 16.4
No intentes replicas horizontales del backend mientras sigas con fotos en volumen local.

Con el estado actual del proyecto, el backend esta mejor preparado para:
- autoescalado vertical

que para:
- varias replicas sirviendo fotos desde filesystem local

## 17. Checklist final despues del despliegue

Cuando termines todo, revisa esta lista:

### Backend
- [ ] `https://api.tudominio.com/health` responde
- [ ] `https://api.tudominio.com/health/ready` responde
- [ ] el backend no da errores de Prisma
- [ ] el volumen esta montado en `/usr/src/app/uploads`

### Frontend
- [ ] `https://app.tudominio.com` carga
- [ ] login funciona
- [ ] no hay errores de CORS
- [ ] dashboard funciona
- [ ] idioma y tema funcionan

### Stripe
- [ ] checkout abre
- [ ] webhook entra en backend
- [ ] cambio de plan actualiza la app

### Fotos
- [ ] puedes subir foto
- [ ] la foto sigue ahi despues de redeploy

### Facturacion
- [ ] el admin ve su estado
- [ ] la demo y los limites funcionan

## 18. Errores tipicos y solucion rapida

### Error 1: el frontend sigue llamando a localhost

Causa:
- `VITE_API_BASE_URL` mal puesta o build antiguo

Solucion:
- corrige la variable en `web`
- fuerza redeploy del frontend

### Error 2: login da CORS

Causa:
- `CORS_ORIGIN` no coincide con el dominio real del frontend

Solucion:
- corrige `CORS_ORIGIN` en `api`
- redeploy del backend

### Error 3: las fotos no se guardan

Causa:
- falta el volumen
- esta montado en ruta incorrecta

Solucion:
- usa exactamente:

```text
/usr/src/app/uploads
```

### Error 4: Stripe no actualiza la suscripcion

Causa:
- webhook mal configurado
- `STRIPE_WEBHOOK_SECRET` incorrecto
- eventos incompletos

Solucion:
- revisa endpoint
- revisa secreto
- revisa eventos

### Error 5: el backend no arranca

Causa:
- `DATABASE_URL` mal referenciada

Solucion:
- revisa:

```env
DATABASE_URL=${{postgres.DATABASE_URL}}
```

## 19. Mi orden recomendado para hacerlo sin liarte

Si lo quieres hacer con el menor riesgo posible, hazlo asi y en este orden:

1. subir repo a GitHub
2. crear proyecto Railway
3. crear `postgres`
4. crear `api`
5. meter variables del backend
6. montar volumen del backend
7. configurar healthcheck del backend
8. desplegar backend
9. comprobar `/health` y `/health/ready`
10. crear `web`
11. meter `VITE_API_BASE_URL` con la URL temporal del backend
12. desplegar frontend
13. probar login
14. conectar dominios finales
15. actualizar `VITE_API_BASE_URL` y `CORS_ORIGIN`
16. redeploy frontend y backend
17. configurar Stripe final
18. configurar FCM si lo necesitas
19. hacer prueba completa funcional

## 20. Archivo tecnico complementario

Si una vez hecho esto quieres entender el por que de cada decision tecnica, sigue con:
- [deploy-railway.md](./deploy-railway.md)
