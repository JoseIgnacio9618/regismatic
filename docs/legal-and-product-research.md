# Marco legal y benchmark de producto

Fecha de referencia: 28 de febrero de 2026.

## 1. Base legal minima en Espana

### Estatuto de los Trabajadores (art. 34.9)
Fuente oficial BOE consolidado:
- https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430

Puntos que impactan directamente en producto:
- Registro diario de jornada incluyendo horario concreto de inicio y finalizacion.
- Organizacion y documentacion del registro segun negociacion colectiva o acuerdo.
- Conservacion de registros durante cuatro anos.
- Disponibilidad para persona trabajadora, representantes e Inspeccion de Trabajo.

### Tratamientos biometricos (criterio de proteccion de datos)
Resolucion AEPD (expediente 2023-0073):
- https://www.aepd.es/documento/2023-0073.pdf

Interpretacion de producto:
- Evitar imponer biometria como unica opcion por defecto.
- Mantener metodo alternativo (credenciales, token, tarjeta, etc.) y principio de minimizacion.

## 2. Benchmark de apps existentes (patrones funcionales)

Referencias consultadas:
- Factorial Control Horario: https://factorialhr.es/software/control-horario
- Sesame HR Control Horario: https://www.sesamehr.es/software/control-horario/
- Jibble (control horario): https://www.jibble.io/es/control-horario-espana
- Personio (registro horario): https://www.personio.es/funciones/control-horario/

Patrones repetidos en el mercado:
- Fichaje en tiempo real desde web/movil.
- Reportes exportables para auditoria.
- Gestion de pausas y horas extra.
- Panel de administracion de plantilla.
- Opciones de localizacion y/o politicas de fichaje remoto.

## 3. Decisiones de producto aplicadas en Regismatic
- Modelo inmutable de eventos para trazabilidad.
- Maquina de estados para bloquear secuencias invalidas de fichaje.
- Reporte diario por persona y export CSV.
- Roles separados (admin/empleado).
- Geolocalizacion opcional en el evento de fichaje.
- Preparacion multiplataforma (Ionic + Capacitor).

## 4. Diferenciadores profesionales sugeridos (siguientes iteraciones)
- Firma digital de registros exportados.
- Flujo de incidencias y validacion de correcciones (doble aprobacion).
- Turnos planificados vs. reales con alertas de desviacion.
- SSO (Azure AD / Google Workspace) y MFA obligatoria para admin.
- Politicas de retencion automatizada y panel RGPD para DPO.
