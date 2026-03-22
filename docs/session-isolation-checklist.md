# Checklist de Aislamiento de Sesion

Objetivo: asegurar que al cambiar de cuenta o de rol no se arrastran datos visuales, filtros, caches o resultados de la sesion anterior.

## Alcance
- `Dashboard`
- `Reportes`
- `Equipo`
- layout superior y notificaciones
- flujos de login y logout

## Preparacion recomendada
1. Tener al menos estas cuentas:
   - `empleado@regismatic.local`
   - `admin@regismatic.local`
   - `superadmin@regismatic.local`
2. Tener datos reales o fixtures para que cada usuario vea contenido distinto.
3. Probar siempre en este orden:
   - cambio de cuenta sin cerrar navegador
   - logout + login
   - cambio entre roles distintos

## Matriz minima de cambios de sesion
Ejecutar todos estos cambios:
1. `EMPLOYEE -> ADMIN`
2. `ADMIN -> EMPLOYEE`
3. `ADMIN -> ADMIN`
4. `SUPERADMIN -> ADMIN`
5. `ADMIN -> SUPERADMIN`
6. `SUPERADMIN -> EMPLOYEE`

## Reglas que siempre deben cumplirse
1. Nunca deben aparecer fichajes, incidencias, usuarios o solicitudes de otra cuenta despues de cambiar de sesion.
2. Los filtros seleccionados por una cuenta no deben sobrevivir al cambio a otra cuenta.
3. Los listados deben recargarse con el contexto del usuario autenticado actual.
4. El layout debe reflejar inmediatamente el rol y nombre de la cuenta nueva.
5. Las notificaciones de la cuenta anterior deben desaparecer al cambiar de usuario.

## Dashboard
Comprobar en cada cambio de sesion:
1. La jornada mostrada corresponde solo al usuario actual.
2. Si se cambia de `EMPLOYEE` a `ADMIN`, no se deben seguir viendo fichajes del empleado anterior.
3. Si la nueva cuenta no tiene solicitudes de union a equipo, la lista debe aparecer vacia.
4. Las metricas diarias deben recalcularse para la cuenta nueva.

Esperado:
- `ADMIN` y `SUPERADMIN` ven solo su propia jornada en dashboard.
- `EMPLOYEE` ve solo su jornada.

## Reportes
Comprobar en cada cambio de sesion:
1. `selectedUserId` vuelve a vacio.
2. Se limpian:
   - resumen
   - detalle de fichajes
   - incidencias pendientes
   - edicion en curso
   - solicitud en curso
3. Al recargar, el alcance coincide con el rol actual.
4. Si entras con un `EMPLOYEE`, no debe quedar visible ninguna seleccion de usuario previa de un admin.

Esperado:
- `EMPLOYEE`: solo sus datos.
- `ADMIN`: sus datos y los de su plantilla segun selector, pero nunca restos de una cuenta anterior.
- `SUPERADMIN`: vision global, sin filtros heredados de otra sesion.

## Equipo
Comprobar en cada cambio de sesion:
1. Se limpian:
   - listado de usuarios
   - solicitudes pendientes
   - filtros de busqueda
   - filtro de rol
   - pagina actual de paginacion
   - formulario de alta
   - selector de responsable
2. Si entras como `ADMIN`, solo ves empleados propios.
3. Si entras como `SUPERADMIN`, ves el alcance global.
4. Si entras como `EMPLOYEE`, no debes acceder a esta pantalla.

Esperado:
- ninguna fila, solicitud o formulario de la cuenta anterior debe seguir visible.

## Layout y notificaciones
Comprobar:
1. El nombre y rol de cabecera cambian inmediatamente al cambiar de cuenta.
2. El contador de notificaciones se reinicia con la nueva cuenta.
3. El popover de notificaciones muestra solo las de la cuenta actual.
4. Tras logout:
   - no quedan notificaciones antiguas visibles
   - no queda avatar o nombre de la cuenta anterior

## Logout
Comprobar:
1. Logout desde `Dashboard`
2. Logout desde `Reportes`
3. Logout desde `Equipo`

Esperado:
1. Se elimina el token.
2. El usuario en memoria pasa a `null`.
3. La UI no sigue mostrando datos privados al volver a login.

## Evidencias de correccion ya aplicadas
Pantallas reforzadas para reaccionar a cambio de usuario:
- `frontend/src/app/pages/dashboard/dashboard.page.ts`
- `frontend/src/app/pages/reports/reports.page.ts`
- `frontend/src/app/pages/users/users.page.ts`

Servicio ya reactivo al cambio de sesion:
- `frontend/src/app/core/services/notification.service.ts`

## Recomendacion operativa
Pasar esta checklist siempre que se toque cualquiera de estas areas:
1. autenticacion
2. logout
3. navegacion principal
4. guards
5. caches locales
6. notificaciones
7. pantallas con tablas o filtros persistentes

## Limitacion actual
No hay una suite e2e completa montada en el proyecto para automatizar esta checklist de punta a punta. A dia de hoy debe ejecutarse manualmente o ampliarse con una herramienta e2e en un paso posterior.
