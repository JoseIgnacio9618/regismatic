# Frontend (Ionic Angular)

Frontend de Regismatic en Ionic Angular.

## Comandos
- `npm run dev`: arranca con `ionic serve` en `http://localhost:8100`
- `npm run start`: arranca con `ng serve`
- `npm run build`: build de produccion (`www/`)
- `npm run cap:sync`: sincroniza Capacitor
- `npm run cap:android`: ejecuta Android
- `npm run cap:ios`: ejecuta iOS

## Variables
Archivo de ejemplo: `.env.example`.

En local con `ionic serve` se usa `src/environments/environment.ts` (`http://localhost:4000/api`).
Para Docker produccion, la URL API se inyecta en build con `VITE_API_BASE_URL`.
