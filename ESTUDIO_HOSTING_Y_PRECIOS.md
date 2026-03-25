# Estudio realista de costes, hosting y viabilidad para Regismatic

Fecha del estudio: 2026-03-25

## 1. Resumen ejecutivo

Inspirandome en la conversacion antigua, pero aterrizandola al estado real del proyecto hoy, mi conclusion es esta:

- Solo se consideran en este estudio opciones con `autoescalado real`.
- Como tu prioridad declarada es que el sistema crezca solo cuando lleguen mas peticiones y que ademas puedas poner un maximo para no llevarte una factura sorpresa, la recomendacion tecnica cambia.
- Con la app actual, un presupuesto realista para salir a produccion con autoescalado y algo de control de gasto esta mas cerca de `15-35 EUR/mes` que de `5-10 EUR/mes`.
- El coste tecnico sigue siendo razonable. El riesgo economico real continuara estando mas en soporte, ventas y operacion que en la infraestructura.

## 2. En que estado esta la app hoy y por que eso importa al coste

Segun el repositorio actual, Regismatic ya no es un MVP trivial. Hoy incluye:

- frontend `Ionic Angular`
- backend `Express + Prisma`
- `PostgreSQL`
- `Stripe` para facturacion
- `FCM` para push
- exportaciones Excel
- fotos de perfil
- notificaciones internas
- roles `EMPLOYEE`, `ADMIN`, `SUPERADMIN`
- bloqueo de fichaje por facturacion inactiva
- hardening basico de API: saneado, rate limit, validacion estricta

Y el despliegue actual de produccion del repo esta pensado asi:

- `web`
- `api`
- `db`
- `proxy` con `Caddy`
- volumen local para fotos

Eso tiene una consecuencia importante:

- Hoy Regismatic funciona especialmente bien en un `solo host`.
- Si quisieras escalar horizontalmente la API de forma limpia, te interesaria sacar las fotos del filesystem local y mover la base de datos fuera del mismo host.

Por eso, y dado que aqui ya descartamos cualquier opcion sin autoescalado, el estudio se centra en plataformas gestionadas que permitan crecer y a la vez limitar el gasto.
## 3. Si la prioridad es autoescalar con tope maximo

Con ese criterio, para Regismatic hoy yo elegiria asi:

## Recomendacion principal: Railway

Combina bastante bien estas tres cosas:

- escalado automatico por uso
- coste razonable al principio
- posibilidad de poner limites y vigilar mejor la factura

### Por que encaja mejor con lo que quieres

Porque has pedido exactamente esto:

- que cuando lleguen mas peticiones el sistema suba recursos
- que no tengas que redimensionar a mano todo el rato
- que puedas poner un maximo para que no se dispare el gasto de golpe

Y ahi Railway me parece hoy la opcion mas equilibrada para Regismatic.

## 4. Como dejaria Regismatic para que autoescale de forma sana

Para que ese autoescalado sea real y no una fuente de problemas, haria esto:

### Frontend

- servirlo como estatico aparte
- no consumir compute dinamico para la web si no hace falta

### API

- desplegarla en plataforma con autoescalado
- fijar un maximo de replicas/consumo

### Base de datos

- PostgreSQL fuera de un host unico
- asumir que aqui estara buena parte del coste fijo

### Fotos

- moverlas a object storage
- no depender del disco local de la API si quieres replicas de verdad

### Limites de seguridad economica

- tope de gasto mensual o de consumo
- alertas por umbral
- limites de replicas o instancias

## 5. Proveedor que veo mas coherente si tu prioridad es autoescalado

## Railway

Datos oficiales relevantes:

- plan `Hobby`: `5 USD` de minimo de uso mensual con `5 USD` de credito incluido
- `CPU`: `0.00000772 USD por vCPU/seg`
- `RAM`: `0.00000386 USD por GB/seg`
- `Volume`: `0.00000006 USD por GB/seg`
- `Object Storage`: `0.015 USD por GB/mes`
- `Egress`: `0.05 USD por GB`

### Mi lectura

- Para `autoescalar con cierto control de factura`, me parece la opcion mas equilibrada de las que si cumplen tu requisito.
- Si mañana entran mas usuarios, la plataforma esta mejor preparada para absorberlo.
- Si ademas configuras bien los limites de uso y vigilas el consumo, reduces mucho el riesgo de susto.

## 6. Cuanto costaria Regismatic de verdad con autoescalado

Voy a separar dos escenarios:

- `autoescalado minimo viable`
- `autoescalado prudente`

### Escenario A: autoescalado minimo viable

Pensado para salir con autoescalado, pero sin pasarte de gasto.

Componentes:

- backend/API en Railway
- PostgreSQL en Railway
- frontend estatico aparte
- object storage para fotos
- dominio

### Total realista

- `15-25 EUR/mes` en una etapa muy inicial y de poco uso real

### Mi lectura

Este es el numero que yo usaria como referencia si quieres autoescalado desde el principio sin sobredimensionar.

### Escenario B: autoescalado prudente

Pensado para operar con un poco mas de margen y sin ir tan al limite.

### Total realista

- `25-45 EUR/mes`

### Mi lectura

Este es el rango que me parece mas honesto para una puesta en produccion pequena, pero bien planteada, con autoescalado y con cierto control de consumo.

## 7. Estimacion por volumen de uso

Estas cifras no son una tarifa oficial. Son una estimacion razonable basada en el software que hay hoy en el repo.

## 0 usuarios

La app esta publicada, pero nadie la usa.

### Coste realista

- `15-25 EUR/mes`

Explicacion:

- el suelo de base de la plataforma sigue existiendo
- el dominio sigue existiendo
- sigues teniendo base de datos y algo de almacenamiento
- aun no aprovechas el autoescalado, pero si estas pagando la comodidad de tenerlo listo

## 10 usuarios

### Coste realista

- `15-28 EUR/mes`

Explicacion:

- practicamente igual que con 0 usuarios
- con este volumen no deberias necesitar grandes saltos
- el beneficio aqui no es el ahorro, sino tener ya el mecanismo de crecimiento preparado

## 100 usuarios

### Coste realista

- `22-45 EUR/mes`

Explicacion:

- aqui ya es razonable que la API suba consumo puntualmente
- sobre todo por reportes, exportaciones Excel y accesos concurrentes
- sigue siendo un coste asumible para un SaaS B2B pequeno

## 1000 usuarios

### Coste realista

- `60-160 EUR/mes`

Explicacion:

A este nivel normalmente ya haria al menos una de estas cosas:

- subir limites de consumo o replicas
- reforzar base de datos
- revisar exportaciones y consultas pesadas
- reforzar monitorizacion, alertas y almacenamiento

Aqui ya no hablas de \"el hosting mas barato\", sino de fiabilidad, topes de gasto y crecimiento ordenado.

## 8. Comparativa honesta entre opciones con autoescalado

Como no te interesan opciones sin autoescalado, la comparativa se queda solo con alternativas que si encajan en ese requisito.

## Railway

Datos oficiales relevantes:

- plan `Hobby`: `5 USD` de minimo de uso mensual con `5 USD` de credito incluido
- `CPU`: `0.00000772 USD por vCPU/seg`
- `RAM`: `0.00000386 USD por GB/seg`
- `Volume`: `0.00000006 USD por GB/seg`
- `Object Storage`: `0.015 USD por GB/mes`
- `Egress`: `0.05 USD por GB`

### Mi lectura

- Railway es muy bueno para probar y para salir rapido.
- Pero con la app tal y como esta hoy, un despliegue estable en Railway no me parece tan barato como a veces se vende.
- Si mantienes API, Postgres y cierta persistencia con comodidad, yo no haria numeros por debajo de `20-45 EUR/mes` de forma realista.

## Render

Datos oficiales relevantes:

- `Professional`: `19 USD/usuario/mes`
- `Web Service Starter`: `7 USD/mes`
- `Web Service Standard`: `25 USD/mes`
- `Render Postgres Basic-1gb`: `19 USD/mes`
- `SSD persistente`: `0.25 USD/GB/mes`

### Mi lectura

- Render es comodo.
- Pero para una app como esta, el suelo economico ya no es pequeno.
- En una cuenta profesional basica, el minimo razonable se te pone rapidamente en una zona de `40-60 EUR/mes`.
- No me parece la opcion mas agresiva en coste para arrancar.

## DigitalOcean App Platform

Datos oficiales relevantes:

- App Platform contenedor minimo compartido: `5 USD/mes`
- App Platform `1 vCPU / 1 GiB` compartido: `12 USD/mes`
- Development database `512 MiB`: `7 USD/mes`
- Managed PostgreSQL: `desde 15 USD/mes`
- el autoscaling solo esta disponible en instancias dedicadas

### Mi lectura

- Si quieres algo mas gestionado que un VPS, me parece mas razonable que Render en varios casos.
- Aun asi, en cuanto metes base de datos de verdad y no una development database efimera, el coste real ya se te va a `20-35 EUR/mes` como minimo serio.

## Google Cloud Run + Cloud SQL

### Mi lectura

- Es muy buena opcion si en unos meses quieres una arquitectura mas seria.
- Tiene autoescalado muy bueno y puedes limitar instancias.
- Pero para controlar de verdad el coste total requiere mas disciplina de cloud y billing.
- Yo no la pondria como primera opcion si quieres sencillez operativa desde ya.

## 9. Conclusion tecnica clara

Si me ciño a la app que tenemos hoy y a tu prioridad concreta, mi recomendacion es esta:

### La mejor si priorizas autoescalado con tope

- `Railway`
- frontend estatico
- API y base de datos con limites vigilados
- fotos en object storage en cuanto sea posible

### La menos interesante para arrancar si ademas quieres vigilar mucho el coste

- `Render`

No porque sea mala, sino porque su suelo de precio es peor para este punto del proyecto.

## 10. Como pondria el tope maximo para evitar sustos

Si eliges la via de autoescalado, yo dejaria configurado esto desde el dia uno:

1. `gasto maximo mensual`
2. `alerta al 50%, 75% y 90%`
3. `maximo de replicas/instancias`
4. `frontend separado del compute`
5. `fotos fuera del filesystem local`
6. `revisar consultas de reportes y exportaciones`

La idea es esta:

- que el sistema pueda subir recursos
- pero dentro de una caja claramente definida

## 11. Coste fijo real del negocio

Si hablamos solo de tecnologia minima para operar, yo haria dos presupuestos:

### Coste fijo tecnico minimo

- `12-20 EUR/mes`

Incluye:

- servidor
- backup basico
- dominio
- algo minimo de correo o monitorizacion

### Coste fijo tecnico prudente

- `20-35 EUR/mes`

Incluye:

- nodo mas desahogado
- mejor monitorizacion
- backups mejor planteados
- algo mas de margen ante incidencias

## 12. Lo que de verdad no debes confundir con infraestructura

El gasto tecnico no es el unico gasto. De hecho, probablemente tampoco sera el mas importante.

Los costes reales que mas te pueden doler son:

- tiempo de soporte
- tiempo de alta y configuracion a clientes
- comerciales o comisiones
- impagos
- cambios a medida
- incidencias de despliegue o mantenimiento

Dicho de forma simple:

- la infraestructura de Regismatic es barata
- operar y vender Regismatic es lo caro

## 13. Viabilidad economica con los precios actuales de la app

Hoy la app tiene estos tramos publicos orientativos en el repositorio:

- demo `7 dias / 3 usuarios`
- `Pack 10`: `19 EUR/mes`
- `Pack 20`: `29 EUR/mes`
- `Pack 50`: `59 EUR/mes`
- `Pack 100`: `99 EUR/mes`

## Lectura de viabilidad

Si tomamos un coste tecnico prudente de `25 EUR/mes`:

- con `2 clientes` en `Pack 10` casi cubres estructura tecnica
- con `3 clientes` en `Pack 10` la cubres con margen
- con `1 cliente` en `Pack 50` mas otro pequeno ya respiras

Eso confirma algo importante:

- la viabilidad no depende de bajar la infraestructura de `20 EUR` a `10 EUR`
- depende de conseguir clientes y de no regalar soporte infinito

## 14. Recomendacion de despliegue por fases

## Fase 1: autoescalado controlado

### Lo que haria yo

- `Railway`
- frontend estatico aparte
- API y PostgreSQL con limites definidos
- object storage o plan para migrar fotos muy pronto
- alertas de gasto desde el primer dia

### Objetivo

- crecer automaticamente sin redimensionar a mano
- evitar sustos de factura
- validar ventas manteniendo control

## Fase 2: estabilizar y desacoplar

Cuando ya tengas clientes reales y facturacion recurrente:

- sacar fotos a object storage si aun no lo has hecho
- revisar limites de replicas y gasto
- reforzar retencion de copias y monitorizacion
- revisar si Railway sigue encajando o si conviene pasar a Cloud Run

## Fase 3: escalar en serio

Solo cuando ya haya demanda real:

- API stateless de verdad
- base de datos mejor aislada
- object storage
- replicas o instancias con maximos claros
- posiblemente worker separado para exportaciones pesadas

## 15. Recomendacion comercial breve

Inspirandome en la conversacion antigua, mantengo esta conclusion:

- al principio no me gastaria dinero serio en anuncios frios
- priorizaria venta directa, asesorias, gestorias y red de contactos
- para este tipo de SaaS, la pregunta no es "como consigo 1000 usuarios", sino "como consigo 10 clientes que paguen y se queden"

Porque con este software:

- el coste tecnico escala lento
- el negocio se gana o se pierde en comercializacion, onboarding y soporte

## 16. Conclusiones finales

Si quiero ser honesto y realista con Regismatic hoy:

1. Si tu prioridad es `autoescalado con tope de gasto`, la recomendacion principal pasa a ser `Railway`.
2. El coste tecnico de salida con ese enfoque me parece mas realista en `15-35 EUR/mes`.
3. A cambio, ganas crecimiento automatico y mas tranquilidad operativa que con una solucion manual.
4. Para que eso funcione bien, conviene sacar las fotos del disco local y vigilar mucho reportes/exportaciones.
5. El siguiente gran salto no sera \"pagar mas cloud porque si\", sino endurecer arquitectura y mantener el crecimiento dentro de limites claros.

## 17. Fuentes oficiales usadas

- Railway pricing: https://railway.com/pricing
- Render pricing: https://render.com/pricing
- DigitalOcean App Platform pricing: https://www.digitalocean.com/pricing/app-platform
- DigitalOcean managed PostgreSQL pricing: https://docs.digitalocean.com/products/databases/postgresql/details/pricing/
- Google Cloud Run pricing: https://cloud.google.com/run/pricing
- Google Cloud SQL pricing: https://cloud.google.com/sql/pricing
- Namecheap domain pricing reference: https://www.namecheap.com/domains/

## 18. Notas sobre las cifras

- Las cifras de este documento son una estimacion razonable, no una oferta comercial cerrada.
- Los proveedores cloud cambian precios, limites y promos con frecuencia.
- He evitado contar aqui cosas que dependen demasiado del caso, como soporte humano, horas de desarrollo, impuestos o comisiones reales de venta.
- Cuando hago una estimacion de coste mensual de Regismatic, estoy extrapolando desde la arquitectura actual del repositorio y desde precios oficiales publicados a fecha `2026-03-25`.
