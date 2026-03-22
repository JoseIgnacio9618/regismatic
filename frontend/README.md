# Frontend (Ionic Angular)

Cliente web y base multiplataforma de Regismatic, construido con `Ionic + Angular + Capacitor`.

## Stack
- `Angular 20`
- `Ionic 8`
- `Capacitor 7`
- `Ionicons`

## Objetivo
Este frontend sirve para:
- web responsive en escritorio y movil
- futura compilacion nativa para Android e iOS mediante Capacitor
- misma base de UI para roles `EMPLOYEE`, `ADMIN` y `SUPERADMIN`

## Scripts
- `npm run dev`
  - arranca `ionic serve` en `http://localhost:8100`
- `npm run start`
  - arranca `ng serve` en `http://localhost:8100`
- `npm run build`
  - genera build de produccion
- `npm run watch`
  - build en modo observacion
- `npm run test`
  - ejecuta tests Angular/Karma
- `npm run lint`
  - ejecuta lint
- `npm run cap:sync`
  - sincroniza cambios web con plataformas nativas
- `npm run cap:android`
  - ejecuta la app en Android
- `npm run cap:ios`
  - ejecuta la app en iOS

## Configuracion
Archivo de ejemplo:
- [frontend/.env.example](D:/Programacion/Proyectos_Personales/Regismatic/frontend/.env.example)

Uso real:
- en local con `ionic serve` o `ng serve`, la API se toma del entorno Angular (`src/environments`)
- en Docker/produccion, la URL se inyecta en build con `VITE_API_BASE_URL`

## Flujos principales cubiertos en UI
- login
- alta publica de administradores
- alta publica de empleados
- union a equipo mediante codigo de administrador
- fichaje diario
- solicitudes de correccion
- revision de incidencias
- gestion de usuarios y responsables
- notificaciones internas
- fotos de perfil con recorte
- exportacion de reportes
- facturacion con pagina de planes para administradores

## Pantallas principales
- `Login`
- `Dashboard`
- `Reportes`
- `Equipo`
- `Billing`
- `Register Admin`
- `Register Employee`

## Desarrollo local recomendado
Desde la raiz del repositorio:

```bash
npm install
npm run dev:api
npm run dev:web
```

URLs habituales:
- frontend: `http://localhost:8100`
- backend: `http://localhost:4000`

## Compilacion movil
Desde `frontend/`:

```bash
npm run build
npm run cap:sync
npx cap add android
# o
npx cap add ios
```

## Push en Android/iOS
El frontend ya integra el plugin:
- `@capacitor/push-notifications`

Para que funcione de extremo a extremo:
1. configurar Firebase Cloud Messaging
2. definir `FCM_SERVICE_ACCOUNT_JSON` o `FCM_SERVICE_ACCOUNT_PATH` en backend
3. sincronizar plataformas con `npm run cap:sync`

## Notas
- `ionic serve` es el flujo recomendado para desarrollo Ionic
- el frontend usa componentes Ionic (`ion-button`, `ion-modal`, `ion-select`, etc.) tambien validos para empaquetado nativo o escritorio
- la navegacion y permisos efectivos siempre dependen tambien del backend
- la integracion de Stripe en este proyecto usa redireccion desde backend, asi que no requiere clave publica en frontend
