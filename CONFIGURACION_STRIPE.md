# Configuracion de Stripe para Regismatic

Fecha: 2026-03-22

Este documento resume exactamente que necesitas configurar en Stripe para que funcione la facturacion por suscripciones de Regismatic.

## 1. Que necesita Regismatic de tu cuenta de Stripe

Necesitas estos datos:

1. `STRIPE_SECRET_KEY`
2. `STRIPE_WEBHOOK_SECRET`
3. `STRIPE_PRICE_PACK_10_MONTHLY`
4. `STRIPE_PRICE_PACK_20_MONTHLY`
5. `STRIPE_PRICE_PACK_50_MONTHLY`
6. `STRIPE_PRICE_PACK_100_MONTHLY`
7. Las URLs de retorno:
   - `STRIPE_CHECKOUT_SUCCESS_URL`
   - `STRIPE_CHECKOUT_CANCEL_URL`
   - `STRIPE_BILLING_PORTAL_RETURN_URL`

Importante:
- esta integracion no necesita clave publica de Stripe en frontend
- Checkout y Customer Portal se crean desde backend y luego redirigen al usuario

## 2. Que tienes que hacer dentro de Stripe

## Paso 1. Copiar la clave secreta

En Stripe:
- entra en `Developers`
- entra en `API keys`
- copia la `Secret key`

Valor esperado:
- pruebas: `sk_test_...`
- produccion: `sk_live_...`

Ese valor va en:

```env
STRIPE_SECRET_KEY=sk_test_xxx
```

## Paso 2. Crear los 4 precios mensuales

En Stripe:
- entra en `Product catalog` o `Products`
- crea 4 productos con precio recurrente mensual

Recomendacion de nombres:
- `Regismatic Pack 10`
- `Regismatic Pack 20`
- `Regismatic Pack 50`
- `Regismatic Pack 100`

Configuracion de cada precio:
- moneda: `EUR`
- tipo: `Recurring`
- intervalo: `Monthly`

Importes:
- `Pack 10` -> `19 EUR/mes`
- `Pack 20` -> `29 EUR/mes`
- `Pack 50` -> `59 EUR/mes`
- `Pack 100` -> `99 EUR/mes`

Despues copia el `Price ID` de cada uno.

Quedaran asi:

```env
STRIPE_PRICE_PACK_10_MONTHLY=price_xxx
STRIPE_PRICE_PACK_20_MONTHLY=price_xxx
STRIPE_PRICE_PACK_50_MONTHLY=price_xxx
STRIPE_PRICE_PACK_100_MONTHLY=price_xxx
```

## Paso 3. Crear el webhook

En Stripe:
- entra en `Developers`
- entra en `Webhooks`
- crea un endpoint

Endpoint en produccion:

```text
https://api.tudominio.com/api/billing/webhook
```

Eventos que debes seleccionar:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Despues copia el secreto del webhook.

Ese valor va en:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

## Paso 4. Definir las URLs de retorno

Estas URLs no te las da Stripe. Las defines tu.

### Ejemplo en local

```env
STRIPE_CHECKOUT_SUCCESS_URL=http://localhost:8100/billing?checkout=success
STRIPE_CHECKOUT_CANCEL_URL=http://localhost:8100/billing?checkout=cancel
STRIPE_BILLING_PORTAL_RETURN_URL=http://localhost:8100/billing
```

### Ejemplo en produccion

```env
STRIPE_CHECKOUT_SUCCESS_URL=https://app.tudominio.com/billing?checkout=success
STRIPE_CHECKOUT_CANCEL_URL=https://app.tudominio.com/billing?checkout=cancel
STRIPE_BILLING_PORTAL_RETURN_URL=https://app.tudominio.com/billing
```

## 3. Donde tienes que poner cada dato

## Desarrollo local

Puedes ponerlos en:
- `backend/.env`

Referencia de ejemplo:
- [backend/.env.example](D:/Programacion/Proyectos_Personales/Regismatic/backend/.env.example)

## Entorno general Docker local

Puedes ponerlos en:
- `.env`

Referencia:
- [.env.example](D:/Programacion/Proyectos_Personales/Regismatic/.env.example)

## Produccion

Debes ponerlos en:
- `.env.production`

Referencia:
- [.env.production.example](D:/Programacion/Proyectos_Personales/Regismatic/.env.production.example)

## 4. Variables completas de Stripe

Bloque completo:

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PACK_10_MONTHLY=price_xxx
STRIPE_PRICE_PACK_20_MONTHLY=price_xxx
STRIPE_PRICE_PACK_50_MONTHLY=price_xxx
STRIPE_PRICE_PACK_100_MONTHLY=price_xxx
STRIPE_CHECKOUT_SUCCESS_URL=http://localhost:8100/billing?checkout=success
STRIPE_CHECKOUT_CANCEL_URL=http://localhost:8100/billing?checkout=cancel
STRIPE_BILLING_PORTAL_RETURN_URL=http://localhost:8100/billing
```

## 5. Como probarlo en local

Ademas de las variables, necesitas Stripe CLI:

```bash
stripe login
stripe listen --forward-to http://localhost:4000/api/billing/webhook
```

Ese comando te dara un secreto temporal:
- `whsec_...`

Ese secreto puedes usarlo en local como:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

## 6. Comportamiento actual de Regismatic con Stripe

La integracion implementada hace esto:

- los admins nuevos arrancan con:
  - demo de `7 dias`
  - limite de `10 usuarios`
- se intenta evitar multicuentas demo por IP
- cada empleado aceptado en el equipo cuenta para el limite del plan
- el limite se aplica en:
  - creacion directa de empleados por admin
  - aceptacion de solicitudes de union a equipo
- el `SUPERADMIN` no queda limitado por Stripe
- los admins pueden:
  - ver su plan actual
  - ver plazas usadas y disponibles
  - abrir Checkout para contratar o cambiar plan
  - abrir Customer Portal para gestionar la suscripcion

## 7. Checklist rapido

Cuando vuelvas a esto otro dia, revisa esta lista:

1. Obtener `STRIPE_SECRET_KEY`
2. Crear `Pack 10`
3. Crear `Pack 20`
4. Crear `Pack 50`
5. Crear `Pack 100`
6. Copiar los cuatro `price_...`
7. Crear webhook a `/api/billing/webhook`
8. Seleccionar los 4 eventos necesarios
9. Copiar `STRIPE_WEBHOOK_SECRET`
10. Rellenar URLs de retorno
11. Guardar todo en `.env` o `.env.production`
12. Aplicar migraciones:

```bash
npm run prisma:migrate --workspace backend
```

13. Reiniciar backend

## 8. Referencias del proyecto

Archivos clave donde esta implementado:
- [billing.service.ts](D:/Programacion/Proyectos_Personales/Regismatic/backend/src/services/billing.service.ts)
- [billing.controller.ts](D:/Programacion/Proyectos_Personales/Regismatic/backend/src/controllers/billing.controller.ts)
- [billing.routes.ts](D:/Programacion/Proyectos_Personales/Regismatic/backend/src/routes/billing.routes.ts)
- [billing.page.ts](D:/Programacion/Proyectos_Personales/Regismatic/frontend/src/app/pages/billing/billing.page.ts)
- [deploy-production.md](D:/Programacion/Proyectos_Personales/Regismatic/docs/deploy-production.md)
- [README.md](D:/Programacion/Proyectos_Personales/Regismatic/README.md)
