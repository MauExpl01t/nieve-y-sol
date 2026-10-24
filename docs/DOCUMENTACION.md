# Nieve y Sol: Sistema de Reserva de Horas

Avance del Sprint 2: CRUD de **Clientes** (RF-01 a RF-04), **Reservas** con validación de disponibilidad (RF-15, RF-16, RF-18 a RF-20, RF-22 a RF-25) y **Recursos** (RF-11 a RF-14), con API REST en Node.js/Express, base de datos PostgreSQL y frontend en React.

Guía detallada para Windows, con solución a problemas frecuentes: [docs/instalacion-windows.md](instalacion-windows.md).
Cómo comprobar cada requerimiento: [docs/casos-de-prueba.md](casos-de-prueba.md).

## Requisitos

- Node.js en su versión LTS (mínimo 20.19)
- PostgreSQL 14 o superior (pgAdmin es opcional: el proyecto crea la base de datos solo)

## Instalación y ejecución

1. Instalar dependencias:
   ```
   npm install
   ```
2. Copiar `.env.example` como `.env` y poner la clave de tu usuario de PostgreSQL en `DATABASE_URL`.
3. Crear la base de datos, las tablas y los datos de prueba (la base de datos se crea sola si no existe):
   ```
   npm run db:seed
   ```
   `npm run db:init` crea solo las tablas, sin datos. `npm run db:reiniciar` borra todo y deja los datos de prueba originales.
4. Compilar el frontend en React (genera la carpeta `dist/`):
   ```
   npm run build
   ```
5. Iniciar el servidor:
   ```
   npm start
   ```
   Abrir http://localhost:3000 e iniciar sesión (ver "Inicio de sesión" más abajo; para probar: `admin@nieveysol.cl` con `Admin#2026`).
6. Comprobar los requerimientos:
   ```
   npm test
   ```
   Incluye pruebas unitarias y pruebas de la API completa. Las de la API usan una base de datos aparte (`nieve_y_sol_test`, se crea sola), así que nunca tocan tus datos. Si PostgreSQL no está encendido, esas pruebas se omiten.

   Con el servidor encendido, en otra ventana, también se puede ejecutar `npm run verificar`, que prueba el sistema real con las mismas peticiones de la pantalla.

Para verificar que el servidor y la base de datos están bien: http://localhost:3000/api/salud debe responder `{"estado":"ok"}`.

### Modo desarrollo (para modificar el código)

Usar dos ventanas de terminal:

```
npm run dev         (ventana 1: backend en el puerto 3000, se reinicia al guardar)
npm run dev:front   (ventana 2: frontend en http://localhost:5173, se actualiza al guardar)
```

En modo desarrollo se trabaja en http://localhost:5173. Para la demostración se usa `npm run build` y `npm start`, y se abre http://localhost:3000. Después de cambiar el frontend, hay que volver a ejecutar `npm run build`.

## Estructura

```
compartido/        Código que usan el navegador y el servidor
  rut.js           Validación de RUT (módulo 11); la usan React y la API
  catalogos.js     Listas cerradas (tipos, estados), horario de atención, acciones por estado
  horario.js       Horas "HH:MM", bloques de 15 minutos y horario de atención
  texto.js         Búsqueda sin tildes y validación de nombres de personas
  permisos.js      Roles y qué puede hacer cada uno en cada módulo
db/
  schema.sql       Tablas y restricciones
  seed.sql         Datos de prueba
frontend/          Frontend en React
  index.html
  src/
    main.jsx       Punto de entrada
    App.jsx        Barra lateral y navegación entre secciones
    api.js         Llamadas a la API y manejo de errores
    paginas/       Reservas.jsx, Clientes.jsx y Recursos.jsx
    componentes/   Diálogo, campos de formulario, selector de cliente con búsqueda, avisos, piezas de tabla,
                   Agenda (vista por día), Menu (acciones "⋯"), Iconos y Logo
    hooks/         useListado (listas con filtros y "ver más"), useDatos (datos para selectores)
    formato.js     Fechas y precios en formato chileno
    estilos.css
src/               Backend (API REST)
  app.js           Configuración de Express, seguridad y logs
  server.js        Punto de entrada
  db.js            Conexión a PostgreSQL
  errores.js       Formato único de errores
  validaciones.js  Validación de datos de entrada
  config.js        Zona horaria del centro (America/Santiago)
  modulos/
    clientes/      rutas.js -> servicio.js -> repositorio.js
    recursos/      rutas.js -> servicio.js -> repositorio.js
    reservas/      rutas.js -> servicio.js -> repositorio.js, y reglas.js (disponibilidad)
    auth/          inicio de sesión: clave.js (hash de contraseñas), servicio.js, middleware.js (sesión y permisos)
    servicios/     catálogo de servicios (solo consulta)
test/              Pruebas unitarias y de la API completa
docs/              Casos de prueba
```

Cada módulo sigue la arquitectura en capas del RNF-08 y del diagrama de componentes:

- **rutas.js**: recibe la petición HTTP, valida los datos y elige el código de respuesta.
- **servicio.js**: reglas de negocio; traduce errores de la base de datos a errores entendibles.
- **repositorio.js**: solo consultas SQL, siempre con parámetros para evitar inyección SQL.

## Inicio de sesión

El sistema exige iniciar sesión (RNF-03). Sin sesión, la pantalla muestra solo el login y la API responde 401 a todo, salvo `/api/salud` y el propio login. Cada persona tiene un rol, y el rol decide qué ve y qué puede hacer (RF-08):

| Rol | Clientes | Reservas | Recursos | Servicios |
|---|---|---|---|---|
| **Administrador** | consultar y modificar | consultar y modificar | consultar y modificar | consultar y modificar |
| **Recepcionista** | consultar y modificar | consultar y modificar | solo consultar | solo consultar |
| **Supervisor** | solo consultar | solo consultar | solo consultar | solo consultar |
| **Mantenedor** | sin acceso | sin acceso | consultar y modificar | consultar y modificar |

El Mantenedor no ve clientes ni reservas porque contienen datos personales (RNF-07). Los permisos están en `compartido/permisos.js`; el navegador los usa para ocultar botones y el servidor los exige en cada petición.

### Personas de demostración

`npm run db:seed` y `npm run db:reiniciar` crean una persona por rol. **Son contraseñas de prueba: cámbialas o crea tus propios usuarios antes de usar el sistema con datos reales.**

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@nieveysol.cl` | `Admin#2026` |
| Recepcionista | `recepcion@nieveysol.cl` | `Recep#2026` |
| Supervisor | `supervisor@nieveysol.cl` | `Super#2026` |
| Mantenedor | `mantenedor@nieveysol.cl` | `Mante#2026` |

Para crear otra persona:

```
npm run usuario:crear -- ana@nieveysol.cl recepcionista "Ana Pérez"
```

Si no se indica una contraseña, se genera una al azar y se muestra una sola vez. Los roles válidos son `administrador`, `supervisor`, `recepcionista` y `mantenedor`.

### Cómo se protege

- **Contraseñas:** nunca se guardan; solo su hash `scrypt` con una sal distinta por persona (tabla `usuario`, columna `password_hash`).
- **Sesión:** al ingresar se entrega una cookie `sid` con un identificador aleatorio de 256 bits. La cookie es `HttpOnly` (JavaScript no la lee) y `SameSite=Lax`; en la base solo queda el hash del identificador (tabla `sesion`). Dura 8 horas, o hasta cerrar sesión.
- **Mensajes:** un correo inexistente, una contraseña errónea y una cuenta inactiva responden lo mismo, y tardan lo mismo, para no revelar qué correos existen.
- **Intentos:** después de 5 intentos fallidos con el mismo correo desde el mismo computador, se bloquea por 10 minutos (429).
- **Cuentas:** una persona con estado `inactivo` no puede ingresar, y sus sesiones abiertas dejan de servir.

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | `{ correo, password }`: abre la sesión y entrega la cookie |
| POST | `/api/auth/logout` | Cierra la sesión (204) |
| GET | `/api/auth/yo` | Quién tiene la sesión abierta (401 si ninguna) |

## Pantalla de Reservas: lista y agenda

- **Resumen de hoy** (sobre la lista): reservas y personas de hoy, pendientes de pago (y cuándo vence la próxima) y la próxima hora del día.
- **Lista**: la acción principal de cada reserva queda a la vista ("Registrar pago" si está pendiente, "Reprogramar" si está confirmada). Las demás (Reprogramar, Cancelar, Eliminar) están en el menú "⋯", con lo destructivo al final y en rojo. Las reservas pendientes muestran una **cuenta regresiva** ("Vence en 12 min") que se pone roja a los 5 minutos.
- **Agenda**: botón "Agenda" junto a "Lista". Una columna por recurso y las horas hacia abajo; los bloques son las reservas (naranja = pendiente de pago, verde = confirmada). Las reservas que coinciden en un mismo recurso (grupos) se dibujan una al lado de la otra. Un clic en un bloque abre su detalle con las acciones permitidas; un clic en un espacio libre abre "Nueva reserva" con el recurso, la fecha y la hora ya elegidos. Lo que ya pasó hoy se ve apagado y no admite reservas. Los recursos en mantención aparecen rayados.
- **Resumen en el formulario**: al crear o reprogramar, antes de guardar se muestra "servicio, recurso, personas, fecha, horario y valor".
- **Inicio de sesión**: portada con una foto real de un campo geotérmico con montaña nevada y botón para mostrar u ocultar la contraseña. Foto de Damian Patkowski en [Unsplash](https://unsplash.com/photos/6hYzm40-byE) (licencia de Unsplash), guardada en `frontend/public/img/termas-nevadas.jpg`. El logo es un dibujo propio (`frontend/public/favicon.svg` y `componentes/Logo.jsx`).
- Las listas muestran filas "esqueleto" mientras cargan y, si están vacías, un botón para crear el primer registro.

Quien solo consulta (Supervisor) ve la lista y la agenda sin botones de acción.

## API

Todas las rutas siguientes exigen sesión abierta y el permiso del rol (ver "Inicio de sesión").

| Método | Ruta | Descripción | RF |
|---|---|---|---|
| GET | `/api/clientes?buscar=&estado=` | Listar, buscar por nombre (sin distinguir tildes) o RUT, y filtrar por estado | RF-02 |
| GET | `/api/clientes/:id` | Ver un cliente | RF-02 |
| POST | `/api/clientes` | Crear `{ nombre, rut }` | RF-01 |
| PUT | `/api/clientes/:id` | Modificar `{ nombre, rut, estado }` | RF-03 |
| DELETE | `/api/clientes/:id` | Eliminar | RF-04 |
| GET | `/api/recursos?buscar=&tipo=&estado=` | Listar y filtrar | RF-12 |
| GET | `/api/recursos/:id` | Ver un recurso | RF-12 |
| POST | `/api/recursos` | Crear `{ nombre, tipo, capacidadMaxima }` | RF-11 |
| PUT | `/api/recursos/:id` | Modificar `{ nombre, tipo, capacidadMaxima, estado }` | RF-13 |
| DELETE | `/api/recursos/:id` | Eliminar | RF-14 |
| GET | `/api/reservas?fecha=&periodo=&recursoId=&clienteId=&estado=&buscar=` | Consultar y filtrar (sin fecha: `periodo=proximas` o `todas`) | RF-18 |
| GET | `/api/reservas/:id` | Ver una reserva | RF-18 |
| POST | `/api/reservas` | Crear `{ clienteId, servicioId, recursoId, fecha, hora, cantidadPersonas? }` (queda pendiente de pago; sin `cantidadPersonas` es 1) | RF-15, RF-16, RF-22 |
| PUT | `/api/reservas/:id` | Reprogramar `{ servicioId, recursoId, fecha, hora, cantidadPersonas?, version? }` (sin `cantidadPersonas` se conserva la actual) | RF-19 |
| POST | `/api/reservas/:id/pago` | Registrar el pago: pasa a confirmada | RF-25 |
| POST | `/api/reservas/:id/cancelar` | Cancelar una pendiente o confirmada (hasta 2 horas antes); queda en el historial | RF-20 |
| DELETE | `/api/reservas/:id` | Eliminar (solo reservas pendientes de pago) | |
| GET | `/api/disponibilidad?servicioId=&recursoId=&fecha=&personas=` | Horarios con cupo ese día para un grupo de `personas` (por defecto 1) | RF-23 |
| GET | `/api/servicios` | Catálogo de servicios con sus recursos | |

`fecha` va como `AAAA-MM-DD` y `hora` como `HH:MM`, en hora de Chile y en bloques de 15 minutos.

Las listas devuelven `{ datos, hayMas }` y aceptan `limite` (1 a 100, por defecto 50) y `desde`. Cualquier otro método HTTP responde 405.

**Ediciones simultáneas:** clientes y reservas tienen un campo `version` que sube en 1 con cada cambio. Al modificar un cliente, reprogramar, pagar o cancelar una reserva, la pantalla envía la `version` que vio; si otra persona lo cambió antes, la API responde 409 `CONFLICTO_VERSION` y no hace nada. El campo es opcional en la API: sin él se guarda sin comprobar.

**Historial de un cliente (RF-01):** `GET /api/reservas?clienteId=<id>&periodo=todas` devuelve todas sus reservas, de cualquier fecha y estado. La pantalla de Clientes lo muestra con el botón "Reservas".

### Reglas de las reservas

- El cliente debe estar **activo** y el recurso **activo**; el servicio debe ser uno de los que ofrece ese recurso.
- La reserva dura lo que dura el servicio, empieza en un bloque de 15 minutos, termina antes del cierre (21:00), es a futuro y no puede ser con más de **un año** de anticipación.
- **Reservas de grupo:** cada reserva indica cuántas personas son (`cantidadPersonas`, por defecto 1) y ocupa **tantos cupos del recurso como personas lleva**. Un grupo no puede ser mayor que la capacidad del recurso. Los horarios con cupo y las sugerencias consideran el tamaño del grupo.
- **Disponibilidad:** un recurso admite varias reservas a la vez mientras la suma de personas que coinciden en el tiempo no supere su capacidad. Se mide el momento de mayor ocupación, no la suma de todas las reservas del día.
- **Sin reservas duplicadas:** crear y reprogramar revisan el cupo dentro de una transacción que bloquea al cliente y al recurso. Si dos personas reservan el último cupo al mismo tiempo, solo una se guarda.
- Un cliente no puede tener dos reservas que se crucen en el tiempo, aunque sean en recursos distintos.
- **Sin cupo** se responde `SIN_DISPONIBILIDAD` con `sugerencias`: los 3 horarios con cupo más cercanos al pedido.
- **Plazo de pago:** una reserva pendiente que no se paga en **30 minutos** (`PLAZO_PAGO_MIN` en `compartido/catalogos.js`) pasa sola a `LIBERADA` y libera el cupo. Se revisa al consultar, crear, reprogramar o registrar un pago, sin necesidad de un proceso aparte.
- **Reprogramar y cancelar** exigen al menos 2 horas de anticipación y una reserva pendiente o confirmada. El cliente de una reserva no se puede cambiar.
- **Cancelar conserva la reserva** en el historial. **Eliminar** la borra, y solo se permite mientras está pendiente de pago (nunca se pagó, no hay nada que conservar). Las canceladas, liberadas, completadas y no-show no se eliminan.
- **Recursos:** no se puede pasar a mantención o inactivo un recurso con reservas futuras, ni bajarle la capacidad por debajo de lo ya reservado. Primero hay que cancelar o reprogramar esas reservas.
- Un cliente o recurso con reservas no se puede eliminar (`TIENE_DEPENDENCIAS`): se desactiva.

Los errores siempre tienen esta forma:

```json
{ "error": { "codigo": "VALIDACION", "mensaje": "Revisa los datos marcados.", "detalles": { "rut": "RUT inválido..." } } }
```

| Código | HTTP | Cuándo |
|---|---|---|
| `VALIDACION` | 400 | Algún dato no cumple las reglas (`detalles` indica cuál) |
| `NO_ENCONTRADO` | 404 | El cliente o recurso no existe |
| `RUT_DUPLICADO` | 409 | Ya hay un cliente con ese RUT |
| `NOMBRE_DUPLICADO` | 409 | Ya hay un recurso con ese nombre |
| `TIENE_DEPENDENCIAS` | 409 | No se puede eliminar porque tiene reservas asociadas |
| `NO_AUTENTICADO` | 401 | No hay sesión abierta, o venció |
| `CREDENCIALES_INVALIDAS` | 401 | Correo o contraseña incorrectos (o cuenta inactiva) |
| `SIN_PERMISO` | 403 | El rol de la persona no puede consultar o modificar ese módulo |
| `DEMASIADOS_INTENTOS` | 429 | Cinco intentos de ingreso fallidos: bloqueado por unos minutos |
| `METODO_NO_PERMITIDO` | 405 | La ruta no acepta ese método (la cabecera `Allow` indica cuáles sí) |
| `CONFLICTO_VERSION` | 409 | Otra persona modificó el cliente o la reserva mientras se editaba |
| `SIN_DISPONIBILIDAD` | 409 | El recurso no tiene cupo en ese horario; incluye `sugerencias` con horarios cercanos (RF-24) |
| `CLIENTE_OCUPADO` | 409 | El cliente ya tiene otra reserva que se cruza con ese horario |
| `ESTADO_NO_PERMITE` | 409 | La acción no corresponde al estado de la reserva (ej. eliminar una confirmada, o pagar una liberada) |
| `FUERA_DE_PLAZO` | 409 | Faltan menos de 2 horas para reprogramar o cancelar |
| `RESERVA_VENCIDA` | 409 | Se intentó registrar el pago de una reserva cuya hora ya pasó |
| `RECURSO_CON_RESERVAS` | 409 | Se intentó dejar de activo un recurso que tiene reservas futuras |
| `CAPACIDAD_EN_USO` | 409 | Se intentó bajar la capacidad de un recurso por debajo de lo ya reservado |
| `ERROR_INTERNO` | 500 | Error del sistema (el detalle queda en el log del servidor) |

## Cambios respecto de la Primera Entrega

Cambios de diseño respecto de la Primera Entrega del informe, con su justificación.

1. **Cliente.estado** (`activo` / `inactivo`): RF-04 permite "eliminar o desactivar". Desactivar conserva el historial de reservas.
2. **Recurso.estado** (`activo` / `en_mantencion` / `inactivo`): RF-12 pide consultar el estado del recurso.
3. **Recurso.tipo** es una lista cerrada (sala, sauna, piscina, terapeuta, instructor) en vez de texto libre, para evitar errores de tipeo.
4. **Cliente.passwordHash es opcional**: un cliente creado por recepción no tiene cuenta web hasta que se registre. La contraseña la gestiona el módulo de autenticación, no este CRUD.
5. **Capa de acceso a datos**: se implementó con consultas SQL en repositorios (librería `pg`) en vez de un ORM, para que cada consulta sea visible y fácil de revisar.
6. **Frontend**: React compilado con Vite y servido como archivos estáticos por Express, tal como indica el diagrama de despliegue ("build SPA servido como estático").

7. **Reserva**: cada reserva ocupa un lugar de la capacidad de un recurso (una persona). Se guarda la hora de término (`fin`), calculada con la duración del servicio, para validar cruces.
8. **Servicio y la tabla `servicio_recurso`**: implementan la relación "Servicio requiere 1..* Recurso" del diagrama de clases. Al reservar, el recurso debe ser uno de los que ofrecen el servicio. El catálogo de servicios se carga con datos de prueba; su CRUD con pantalla queda para después.
9. **Registro manual del pago**: mientras no se integre la pasarela (Sprint 3), recepción registra el pago presencial y la reserva pasa de `PENDIENTE_PAGO` a `CONFIRMADA`, igual que en el diagrama de estados.
10. **Eliminar una reserva**: el enunciado pide CRUD completo, pero eliminar solo se permite mientras la reserva está pendiente de pago (nunca se pagó, no hay historial que perder). Las demás se cancelan (RF-20) y quedan como historial. Una reserva pendiente también se puede cancelar. Para volver a permitir eliminar canceladas basta agregar `'eliminar'` a esos estados en `ACCIONES_POR_ESTADO` (`compartido/catalogos.js`).
11. **Un cliente no puede tener dos reservas que se crucen**, aunque sean en recursos distintos. Evita la duplicidad de reservas descrita en el problema.
12. **Plazo de pago de 30 minutos**: una reserva pendiente que no se paga pasa sola a `LIBERADA`. Lo pide el supuesto del informe ("no bloquear indefinidamente un recurso").
13. **Un recurso con reservas futuras** no puede dejar de estar activo ni bajar su capacidad por debajo de lo reservado.
14. **Un cliente con reservas no se elimina**, ni un recurso o servicio con reservas; se desactivan. Responde 409 `TIENE_DEPENDENCIAS`.
15. **El nombre de un cliente** solo puede tener letras, espacios, punto, guion y apóstrofo. La búsqueda por nombre ignora mayúsculas y tildes.
16. **Campo `version` en Cliente y Reserva**: detecta cuando dos personas editan el mismo registro a la vez (ver "Ediciones simultáneas"). Requiere ejecutar `npm run db:init` o `db:seed` una vez en bases creadas antes.
17. **Reserva.cantidadPersonas** (entero, 1 a 1000, por defecto 1): permite reservar para un grupo. Ocupa tantos cupos del recurso como personas lleva. Las reservas existentes quedan con 1 persona (`db:init` agrega la columna).
18. **Tablas `usuario` y `sesion`** (inicio de sesión, RF-08 y RNF-03): `Usuario` con correo, hash de contraseña y rol (Administrador, Supervisor, Recepcionista, Mantenedor), como en el diagrama de clases. Se agregó `sesion` para abrir y cerrar sesiones. Las bases anteriores se actualizan con `npm run db:init`.
19. **Vista de agenda por día y rediseño visual** (sin cambios en la base de datos ni en la API): ver "Pantalla de Reservas: lista y agenda".

**Supuestos nuevos:**

- La capacidad máxima de un recurso va de 1 a 1000 personas.
- El centro atiende de 09:00 a 21:00 y las reservas usan bloques de 15 minutos. Ambos valores están en `compartido/catalogos.js`.
- Las horas son de Chile (`America/Santiago`), configurable con `ZONA_HORARIA` en `.env`.
- Reprogramar también respeta el límite de 2 horas del RF-20 (RF-19 dice "respetando el límite de anticipación").
- Un grupo se reserva como una sola reserva a nombre de un cliente, con la cantidad de personas. La capacidad del recurso se mide en personas.
- No se puede reservar con más de un año de anticipación.

## Numeración de requerimientos

El código, los casos de prueba y `npm run verificar` usan la numeración de la lista larga de requerimientos (RF-01 a RF-28, una por operación). El informe de la Primera Entrega usa la lista consolidada (RF-01 a RF-11, un CRUD por requerimiento). Esta tabla las relaciona (en el diagrama de secuencia del informe, RF-25 aparece como la liberación automática de pendientes; en el código es el registro del pago).

| En el código | Es | En el informe |
|---|---|---|
| RF-01 a RF-04 | Gestión de clientes | RF-01 |
| RF-11 a RF-14 | Gestión de recursos | RF-03 |
| RF-15, RF-16, RF-18, RF-19, RF-20 | Crear, consultar, reprogramar y cancelar reservas | RF-04 |
| RF-22, RF-23, RF-24 | Validar disponibilidad, consultarla y sugerir alternativas | RF-06 |
| RF-25 | Registrar el pago para confirmar | RF-07 |
| RF-17 | Reservas recurrentes (pendiente) | RF-04 |
| RF-21 | Inasistencia / no-show (pendiente) | RF-05 |
| RF-27, RF-28 | Autenticación y roles (inicio de sesión y permisos listos; falta la pantalla de usuarios) | RF-08 |

## Pendiente

- **Gestión de usuarios con pantalla (RF-08)**: el inicio de sesión y los roles ya funcionan; las personas se crean con `npm run usuario:crear`. Falta una pantalla para administrarlas, y que el cliente final inicie sesión para reservar él mismo (autoservicio).
- **Quién hizo cada cosa**: con el login, la reserva podría guardar quién la creó (`creadaPor` en el diagrama de clases).
- **Procesos automáticos de Reserva**: marcar inasistencias a los 30 minutos (`NO_SHOW`, RF-21) y cerrar las atendidas (`COMPLETADA`). La base de datos ya acepta esos estados. La liberación de pendientes sin pago ya funciona (ver "Reglas de las reservas").
- **Reservas recurrentes (RF-17)** y **pasarela de pago (RF-25, Sprint 3)**. Hoy el pago se registra con un clic, sin monto ni medio de pago; en el diagrama de clases existe la entidad `Pago`, que se crea al integrar la pasarela.
- **CRUD de Servicios con pantalla (RF-06, RF-07)**.

Los datos de prueba incluyen reservas para mañana y pasado mañana. Si pasan los días, quedan como reservas pasadas: ejecutar `npm run db:reiniciar` antes de una demostración.
