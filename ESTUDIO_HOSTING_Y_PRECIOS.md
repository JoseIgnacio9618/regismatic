# Estudio de hosting escalable y propuesta de precios para Regismatic

Fecha del estudio: 2026-03-22

## 1. Resumen ejecutivo

Regismatic no es una web estatica sin estado. Por lo que hace hoy, necesita:

- frontend web estatico
- API Node/Express con Prisma
- PostgreSQL persistente
- almacenamiento persistente para fotos de perfil
- soporte para notificaciones push con Firebase
- picos de CPU puntuales por exportaciones Excel y consultas de reportes

La mejor conclusion para esta aplicacion es esta:

- Para empezar rapido con poco DevOps: `Railway` o `Render`
- Para escalar de forma mas solida a medio plazo: `Cloud Run + Cloud SQL + Cloud Storage`
- El frontend no deberia vivir en el mismo servidor que la API si quieres optimizar coste

La limitacion tecnica mas importante del proyecto actual es esta:

- hoy las fotos de perfil se guardan en disco local del backend (`backend/src/services/profile-photo.service.ts`)
- eso hace que el backend no sea completamente stateless
- si pones varias replicas de API, unas replicas no veran los ficheros subidos en otras salvo que compartan volumen o migres a almacenamiento tipo S3

Mi recomendacion realista:

1. mover fotos a almacenamiento tipo S3 o compatible
2. separar frontend estatico del backend
3. dejar PostgreSQL como servicio gestionado
4. entonces activar autoescalado en la API

## 2. Lo que hace esta app y como impacta en costes

Segun el repositorio actual, Regismatic tiene:

- fichajes y eventos de jornada
- solicitudes de correccion
- solicitudes de union a equipo
- notificaciones internas
- push con Firebase
- fotos de perfil
- exportacion CSV y Excel
- frontend Ionic/Angular compilable a web estatica

### Traduccion tecnica de eso a infraestructura

- `Frontend`: muy barato. Se puede servir como estatico en CDN.
- `Backend API`: coste medio-bajo en reposo, pero con picos cuando hay exportaciones, consultas de reportes o notificaciones.
- `PostgreSQL`: es el servicio mas importante. Debe ser fiable y con backup.
- `Fotos`: el volumen no sera enorme al principio, pero deben salir del disco local si quieres escalar bien.
- `Push`: FCM no suele ser el coste relevante; el coste esta en tu API y en la persistencia de tokens/notificaciones.

## 3. Implicaciones de autoescalado del estado actual

### Lo que ya esta bien

- backend dockerizado
- frontend dockerizado
- health checks
- CORS y hardening basico
- PostgreSQL ya separado como servicio
- autenticacion JWT, asi que no dependes de sticky sessions para escalar la API

### Lo que frenaria un autoescalado limpio

- las fotos se guardan en `uploads/profile-photos` en el filesystem local del contenedor
- en el despliegue actual de produccion el almacenamiento persistente esta pensado como volumen local Docker
- la base de datos vive junto al stack del `docker-compose.prod.yml`, asi que el despliegue actual es de un solo host

### Que cambiaria antes de escalar

- mover fotos a `Cloudflare R2`, `Railway Object Storage`, `AWS S3` o similar
- sacar PostgreSQL a un servicio gestionado
- dejar la API sin dependencia de disco local
- mantener el frontend como build estatico aparte

## 4. Plataformas recomendadas

## Opcion A: Railway

### Cuando la elegiria

- si quieres salir rapido
- si valoras pagar por uso real
- si quieres escalar sin meterte todavia en cloud mas compleja

### Ventajas para Regismatic

- vertical autoscaling nativo
- replicas horizontales
- despliegue sencillo desde Docker
- pricing bastante ajustado al inicio
- object storage disponible si migras fotos

### Inconvenientes

- menos control fino que una arquitectura en GCP/AWS/Azure
- para empresas grandes puede quedarse corto antes que una arquitectura cloud mas clasica

### Coste orientativo para esta app

Tomando los precios oficiales por segundo de Railway:

- CPU: `$0.00000772 por vCPU/seg`
- RAM: `$0.00000386 por GB/seg`
- volumen: `$0.00000006 por GB/seg`
- object storage: `$0.015 por GB/mes`
- egress de servicios: `$0.05 por GB`

Escenario MVP razonable para Regismatic:

- frontend estatico fuera de Railway o en servicio muy pequeno
- API con el equivalente aproximado a `1 vCPU` y `0.5 GB`
- PostgreSQL con el equivalente a `0.5 vCPU`, `1 GB RAM` y `20 GB` de volumen
- almacenamiento de fotos: `5 GB`

Estimacion mensual:

- API: unos `$25.36/mes`
- PostgreSQL: unos `$23.43/mes`
- fotos: unos `$0.08/mes`
- margen para logs, red, backups externos y pequenos picos: `$10-$20/mes`

Total razonable:

- `unos $59 a $69/mes`

Escenario crecimiento temprano:

- `300 a 800` empleados activos en total
- API equivalente a `1 vCPU` y `1 GB`
- PostgreSQL equivalente a `1 vCPU`, `2 GB` y `40 GB`

Total razonable:

- `unos $95 a $130/mes`

## Opcion B: Render

### Cuando la elegiria

- si quieres simplicidad operacional
- si prefieres precios mas faciles de leer mes a mes
- si quieres un PaaS muy comodo para equipo pequeno

### Ventajas para Regismatic

- frontend estatico gratis
- Docker soportado
- Postgres gestionado
- autoscaling disponible en workspace Professional

### Inconvenientes

- para tener autoscaling necesitas `Professional`
- las replicas adicionales de API se cobran por instancia
- si mantienes fotos en disco persistente sigues teniendo una arquitectura peor para multiinstancia
- Render indica expresamente que los servicios con `persistent disk` adjunto no pueden escalar a multiples instancias

### Coste orientativo para esta app

Precios oficiales relevantes:

- Workspace Professional: `$19/usuario/mes`
- Web Service Starter: `$7/mes`
- Web Service Standard: `$25/mes`
- Render Postgres Basic 1 GB: `$19/mes`
- Render Postgres Pro 4 GB: `$55/mes`
- SSD persistente: `$0.25/GB/mes`

Escenario MVP razonable:

- `1` usuario del workspace
- frontend estatico
- API en `Starter`
- PostgreSQL `Basic-1gb`
- `10 GB` de disco para fotos si todavia no migras a object storage

Estimacion mensual:

- workspace: `$19`
- API: `$7`
- PostgreSQL: `$19`
- disco: `$2.50`
- extras prudentes para backup externo y monitorizacion: `$10-$20`

Total razonable:

- `unos $57.50 a $67.50/mes`

Escenario ya mas serio:

- API en `Standard`
- PostgreSQL `Pro-4gb`
- `20 GB` de almacenamiento para ficheros

Total razonable:

- `unos $104 a $124/mes`

Nota importante:

- si activas autoscaling y mantienes mas de una instancia de API, el coste puede subir rapido porque cada instancia adicional se factura completa

## Opcion C: Google Cloud Run + Cloud SQL + Cloud Storage

### Cuando la elegiria

- si quieres una arquitectura mas solida para escalar de verdad
- si quieres separar bien frontend, API, base de datos y ficheros
- si piensas llegar a volumen medio o alto

### Ventajas para Regismatic

- Cloud Run escala automaticamente
- frontend puede ir muy barato en hosting estatico o CDN
- Cloud Storage resuelve bien las fotos
- arquitectura muy limpia para hacer el backend stateless

### Inconvenientes

- mas complejidad de configuracion
- Cloud SQL suele salir mas caro que Railway o Render al principio
- necesitas algo mas de disciplina operativa

### Coste orientativo

Para una app como esta, el cuello de botella economico no suele ser Cloud Run sino `Cloud SQL`.

En la practica:

- etapa muy temprana: `~$40-$90/mes`
- etapa estable con varios cientos de empleados: `~$100-$220/mes`
- a cambio ganas una base mejor para crecer sin rehacer el despliegue

## 5. Recomendacion concreta para Regismatic

Si fueras a lanzar esta semana, mi recomendacion seria:

### Fase 1

- frontend en hosting estatico
- backend + PostgreSQL en `Railway`
- fotos en `Railway Object Storage` o `Cloudflare R2`

Motivo:

- sales rapido
- pagas poco mientras validas
- el salto a replicas y algo de autoescalado es razonable

### Fase 2

- cuando pases de unos `500-1000 empleados activos` o tengas clientes exigentes, valorar migrar a `Cloud Run + Cloud SQL + Cloud Storage`

Motivo:

- mejor separacion de piezas
- mejor elasticidad real
- mejor base para crecer sin depender de volumenes locales

## 6. Estimacion de uso y costes por volumen

Para calcular precios he supuesto un SaaS multiempresa compartiendo infraestructura.

Supuestos prudentes:

- `22` dias laborables por mes
- `4 a 6` eventos por empleado y dia
- algunas consultas de reportes
- exportaciones Excel ocasionales
- una foto de perfil comprimida por usuario

### Volumen de datos orientativo

Por empleado:

- `~90 a 130 eventos/mes`
- `~1 foto`
- `~pocas decenas` de notificaciones/mes

Eso significa que:

- la base de datos crecera de forma manejable durante bastante tiempo
- el verdadero coste inicial no estara en almacenamiento masivo, sino en tener la API y la base siempre disponibles

## 7. Coste total mensual estimado de SaaS compartido

### Escenario 1: arranque comercial

Supuesto:

- `50 a 150` empleados activos totales sumando todos los clientes

Coste mensual realista:

- `EUR 55 a EUR 85/mes` si optimizas y mantienes stack ligero

### Escenario 2: primeros clientes de verdad

Supuesto:

- `300 a 800` empleados activos totales

Coste mensual realista:

- `EUR 90 a EUR 160/mes`

### Escenario 3: ya hay traccion

Supuesto:

- `1000 a 3000` empleados activos totales

Coste mensual realista:

- `EUR 180 a EUR 400/mes`

Estas cifras no incluyen tu sueldo ni soporte humano. Son infraestructura y operacion tecnica basica.

## 8. Cuanto deberias cobrar por usuario para ganar dinero

Si quieres entrar mejor en mercado, tiene sentido bajar precios y vender paquetes cerrados por tramos de usuarios.

Para esta app, un modelo razonable y mas facil de vender seria:

- paquetes cerrados por numero maximo de usuarios
- precio claro sin formulas raras
- mas de `100` usuarios con presupuesto personalizado

## Modelo recomendado de precios

### Opcion recomendada

- `Pack 10 usuarios: 19 EUR/mes`
- `Pack 20 usuarios: 29 EUR/mes`
- `Pack 50 usuarios: 59 EUR/mes`
- `Pack 100 usuarios: 99 EUR/mes`
- `Mas de 100 usuarios: contacto comercial y contrato a medida`

### Por que esta estructura tiene sentido

- es mucho mas facil de entender para una pyme
- el cliente sabe desde el primer minuto lo que va a pagar
- la barrera de entrada baja bastante frente al planteamiento anterior
- sigues teniendo margen si compartes infraestructura entre clientes

## 9. Ejemplos de margen con ese pricing

### Cliente pequeno

Supuesto:

- `10` empleados activos

Facturacion:

- pack contratado `19 EUR/mes`

Comentario:

- es una entrada mucho mas facil para autonomos o microempresas
- el margen es menor, pero te ayuda a captar clientes con menos friccion

### Cliente medio

Supuesto:

- `25` empleados activos

Facturacion:

- necesitaria el `Pack 50`
- total `59 EUR/mes`

Comentario:

- sigue siendo un precio bastante vendible
- aqui ya puedes tener margen aceptable si compartes bien la infraestructura

### Cliente mas grande

Supuesto:

- `100` empleados activos

Facturacion:

- pack contratado `99 EUR/mes`

Comentario:

- ya es un ticket util para sostener soporte e infraestructura
- por encima de este punto conviene pasar a venta consultiva

## 10. Costes fijos, margen comercial y punto de equilibrio

Para aterrizar la rentabilidad, tomo una hipotesis prudente y util para venta inicial:

- coste fijo mensual de infraestructura compartida: `70 EUR/mes`
- dominio, correo operativo, copias externas y monitorizacion minima: `15 EUR/mes`
- coste fijo mensual total de referencia: `85 EUR/mes`

Ademas, para no engañarnos con un margen irreal, supongo un coste variable directo medio de:

- `0.35 EUR por usuario/mes`

Ese coste variable intenta cubrir:

- crecimiento de PostgreSQL
- almacenamiento de fotos
- trafico de red
- notificaciones y operacion basica
- margen de seguridad por picos pequenos

### Que significa exactamente cada coste

- `Coste fijo mensual global`: `85 EUR/mes`
  - lo pagas por tener el servicio disponible aunque no entre ningun cliente
  - incluye infraestructura minima, dominio, correo tecnico, copias y monitorizacion basica
- `Coste variable`: `0.35 EUR por usuario/mes`
  - solo crece cuando crecen los usuarios activos de pago
  - es el coste que puedes atribuir de forma directa a cada cliente segun su tamaño

### Coste variable por cliente segun plan

| Plan | Usuarios incluidos | Coste variable estimado por cliente |
|---|---:|---:|
| Pack 10 | 10 | 3.50 EUR/mes |
| Pack 20 | 20 | 7.00 EUR/mes |
| Pack 50 | 50 | 17.50 EUR/mes |
| Pack 100 | 100 | 35.00 EUR/mes |

### Por que el coste fijo esta puesto en 85 EUR/mes

No es porque la app obligue tecnicamente a pagar exactamente eso desde el dia uno. Es una estimacion prudente para operar con cierta tranquilidad comercial y tecnica.

Ese `85 EUR/mes` sale de pensar en un arranque serio pero todavia ligero:

- backend y base de datos siempre encendidos
- almacenamiento persistente
- cierto margen para picos pequenos
- dominio y correo profesional
- copias externas o al menos una capa minima de proteccion
- monitorizacion basica para no ir completamente a ciegas

Dicho de forma simple:

- no es el minimo absoluto posible
- es un fijo razonable para no hacer un calculo demasiado optimista

### Si tienes 0 usuarios, si: ese fijo se sigue pagando

Si mantienes la plataforma desplegada y disponible, con `0 usuarios` sigues pagando el coste fijo global.

Con esta hipotesis:

- `0 usuarios`: pagarias aproximadamente `85 EUR/mes`
- `10 usuarios`: pagarias `85 + 3.50 = 88.50 EUR/mes`
- `50 usuarios`: pagarias `85 + 17.50 = 102.50 EUR/mes`
- `100 usuarios`: pagarias `85 + 35 = 120 EUR/mes`

### Se puede bajar ese coste fijo inicial

Si quisieras arrancar de forma mas agresiva en ahorro, el fijo podria bajar aproximadamente a una banda como esta:

- `40 a 60 EUR/mes`

Pero solo aceptando mas compromiso:

- menos margen de seguridad
- menos observabilidad
- menos comodidad operativa
- mas dependencia de configuraciones muy justas

Mi recomendacion empresarial seria esta:

- usar `85 EUR/mes` como escenario prudente para calcular rentabilidad
- usar `50 EUR/mes` como escenario optimista de arranque muy ajustado

Asi no te engañas al hacer pricing, pero tampoco pierdes de vista que puedes empezar algo mas barato si hace falta.

### Margen comercial estimado por plan

| Plan | Precio mensual | Usuarios incluidos | Coste variable estimado | Margen bruto por plan | Margen bruto % |
|---|---:|---:|---:|---:|---:|
| Pack 10 | 19 EUR | 10 | 3.50 EUR | 15.50 EUR | 81.6% |
| Pack 20 | 29 EUR | 20 | 7.00 EUR | 22.00 EUR | 75.9% |
| Pack 50 | 59 EUR | 50 | 17.50 EUR | 41.50 EUR | 70.3% |
| Pack 100 | 99 EUR | 100 | 35.00 EUR | 64.00 EUR | 64.6% |

Lectura comercial:

- el `Pack 10` sigue siendo bueno como puerta de entrada y captacion
- el `Pack 20` ya empieza a tener una relacion margen/precio muy razonable
- `Pack 50` y `Pack 100` son los que de verdad consolidan rentabilidad
- en empresas grandes conviene seguir pasando a presupuesto a medida

### Punto de equilibrio por plan vendido al 100% de su capacidad

| Plan | Margen bruto por plan | Clientes necesarios para cubrir 85 EUR/mes | Usuarios incluidos equivalentes |
|---|---:|---:|---:|
| Pack 10 | 15.50 EUR | 6 clientes | 60 usuarios |
| Pack 20 | 22.00 EUR | 4 clientes | 80 usuarios |
| Pack 50 | 41.50 EUR | 3 clientes | 150 usuarios |
| Pack 100 | 64.00 EUR | 2 clientes | 200 usuarios |

### Punto de equilibrio expresado en usuarios

Si llevas cada plan bastante lleno, el punto de equilibrio aproximado seria:

- `Pack 10`: alrededor de `55 usuarios`
- `Pack 20`: alrededor de `78 usuarios`
- `Pack 50`: alrededor de `103 usuarios`
- `Pack 100`: alrededor de `133 usuarios`

### Mi lectura realista

En un escenario comercial normal, con mezcla de clientes pequenos y medianos, el punto de equilibrio razonable para Regismatic estaria aproximadamente en:

- `70 a 100 usuarios activos de pago`

Eso es una referencia bastante util porque:

- no exige un volumen enorme para cubrir infraestructura
- te permite usar el pack de `10 usuarios` como entrada comercial sin que te hunda el modelo
- a partir de ahi cada cliente nuevo mejora bastante la rentabilidad

## 11. Version comercial aun mas afinada

Si quieres dejarlo muy claro en la web, yo lo presentaria asi:

### Plan Starter

- `19 EUR/mes`
- incluye hasta `10 usuarios`
- pensado para microempresas

### Plan Team

- `29 EUR/mes`
- incluye hasta `20 usuarios`
- pensado para equipos pequenos

### Plan Growth

- `59 EUR/mes`
- incluye hasta `50 usuarios`
- pensado para pymes que ya operan con varios turnos o equipos

### Plan Business

- `99 EUR/mes`
- incluye hasta `100 usuarios`
- soporte prioritario por email

### Plan Enterprise

- mas de `100 usuarios`
- contacto por telefono
- contrato personalizado
- posibilidad de onboarding, soporte ampliado y condiciones especiales

Esta tabla funciona mejor comercialmente que un precio variable puro, porque:

- crea sensacion de producto serio
- evita calculos en cada visita comercial
- hace mucho mas facil publicar pricing en la web

## 12. Margen bruto esperado

Si compartes infraestructura entre clientes, este modelo sigue pudiendo funcionar bien, aunque con menos margen que la propuesta inicial.

Ejemplo simple:

- `10 clientes` en `Pack 10` supondrian `190 EUR/mes`
- `5 clientes` en `Pack 20` supondrian `145 EUR/mes`
- `3 clientes` en `Pack 50` supondrian `177 EUR/mes`
- total ejemplo: `512 EUR/mes`

Frente a una infraestructura de `EUR 90-160/mes`, seguirias teniendo margen bruto razonable.

Conclusion operativa:

- estos precios ya son bastante mas agresivos
- el `Pack 10` es casi de captacion
- donde realmente se empieza a notar la rentabilidad es en `Pack 50` y `Pack 100`
- por encima de `100` usuarios tiene sentido cerrar contrato a medida para no pillarte los dedos

## 13. Decision final que tomaria yo

Si tuviera que decidir hoy:

1. `Lanzar en Railway`
2. `Sacar las fotos del disco local` antes de activar replicas de API
3. `Publicar precios cerrados de 19, 29, 59 y 99 EUR al mes`
4. `Revisar metricas reales durante 2-3 meses`
5. `Pedir llamada o contrato a medida a partir de 100 usuarios`
6. `Migrar a arquitectura tipo Cloud Run` cuando el producto ya tenga traccion suficiente para justificarlo

## 14. Siguiente trabajo tecnico recomendado en el repo

Antes de venderlo a varios clientes, haria estas tareas:

1. mover las fotos de perfil a object storage
2. parametrizar URL publica o privada de ficheros
3. separar despliegue del frontend como estatico
4. sacar PostgreSQL fuera del `docker-compose` de un solo servidor
5. anadir monitorizacion minima de API, DB y jobs de backup

## 15. Fuentes oficiales usadas

Precios y capacidad pueden cambiar, asi que conviene revisarlos al contratar.

- Render Pricing: https://render.com/pricing
- Railway Pricing: https://railway.com/pricing
- Cloud Run Pricing: https://cloud.google.com/run/pricing

Notas:

- Render indica en su documentacion que el autoscaling esta disponible en `Professional` o superior.
- Cloud Run indica en su pricing oficial que escala automaticamente.
- Para Railway he usado su pagina oficial de pricing porque publica precios por CPU, RAM, volumen, egress y object storage.

## 16. Nota final

Este estudio esta hecho segun la arquitectura y el codigo actuales del repositorio. Si despues cambias a:

- multi-tenant mas estricto
- colas para exportaciones
- S3 para fotos
- cache Redis
- auditoria o retencion ampliada

entonces te convendra rehacer el modelo de costes porque el punto de equilibrio mejorara, pero tambien cambiara la estructura de infraestructura.
