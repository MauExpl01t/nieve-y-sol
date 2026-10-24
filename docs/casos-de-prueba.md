# Verificación de requerimientos: Clientes, Reservas y Recursos

Hay tres formas de comprobar que el sistema cumple, de la más rápida a la más completa.

## 1. Verificación automática de requerimientos (1 minuto)

Con el sistema encendido (`npm start` en una ventana), abrir otra ventana de cmd en la carpeta del proyecto y ejecutar:

```
npm run verificar
```

Inicia sesión como administrador con la persona de demostración (otra: variables `VERIFICAR_CORREO` y `VERIFICAR_CLAVE`) y hace 43 comprobaciones contra el sistema real (servidor y base de datos), cada una marcada con el requerimiento que prueba. Al final debe decir **"Resultado: 43 de 43 verificaciones correctas"**. Las reservas de prueba se hacen en una fecha de varios meses adelante y lo que crea se borra al terminar. La excepción son las reservas canceladas: se conservan como historial (no se pueden eliminar), así que los clientes de prueba que las tienen quedan *inactivos*; el script lo avisa al final.

## 2. Pruebas automáticas (segundos)

```
npm test
```

Incluye dos tipos de pruebas:

- **Unitarias** (no necesitan base de datos): RUT, largos de texto, rangos de capacidad, listas de opciones, búsqueda sin tildes, validación de nombres, y las reglas de reservas (cruces de horario, capacidad, sugerencias, plazo de 2 horas y acciones por estado).
- **De la API completa** (`test/api.test.js`): crean y eliminan datos en una base de datos aparte, `nieve_y_sol_test` (se crea sola, y la de desarrollo nunca se toca). Cubren, entre otras cosas, que dos reservas simultáneas por el último cupo no se dupliquen, el vencimiento del plazo de pago, y que un recurso con reservas futuras no cambie de estado. Si PostgreSQL no está encendido, se omiten.

Debe decir `fail 0`. Con PostgreSQL encendido son 70 pruebas (`pass 70`).

## 3. Casos de prueba manuales en la pantalla

Formato pedido en el enunciado (sección 10, punto 5). Se ejecutan en http://localhost:3000 justo después de `npm run db:reiniciar`, en el orden indicado. Completar "Resultado obtenido" y guardar capturas como evidencia.

## Inicio de sesión

Las personas de demostración y sus contraseñas están en el README ("Inicio de sesión"). Estos casos se ejecutan primero, con el sistema recién abierto.

| ID | Requerimiento | Funcionalidad | Datos utilizados | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| CP-46 | RNF-03 | Sin sesión no se entra | Abrir http://localhost:3000 sin haber ingresado | Aparece solo el formulario de ingreso; no hay menú ni datos | |
| CP-47 | RNF-03 | Contraseña incorrecta | `admin@nieveysol.cl` con `incorrecta` | "Correo o contraseña incorrectos."; sigue en el login | |
| CP-48 | RNF-03 | Ingresar como administrador | `admin@nieveysol.cl` / `Admin#2026` | Entra a Reservas; el menú trae Reservas, Clientes y Recursos; abajo aparece "Administrador" y "Cerrar sesión" | |
| CP-49 | RF-08 | Recepcionista | `recepcion@nieveysol.cl` / `Recep#2026` | Gestiona clientes y reservas; en Recursos solo consulta (sin "Nuevo recurso" ni Editar) | |
| CP-50 | RF-08 | Supervisor | `supervisor@nieveysol.cl` / `Super#2026` | Ve clientes, reservas y recursos, pero sin botones para crear, modificar ni eliminar | |
| CP-51 | RF-08, RNF-07 | Mantenedor | `mantenedor@nieveysol.cl` / `Mante#2026` | El menú trae solo Recursos; puede crear y editar recursos | |
| CP-52 | RNF-03 | Cerrar sesión | "Cerrar sesión" | Vuelve al login; el botón "atrás" del navegador no muestra datos | |
| CP-53 | RNF-03 | Sesión vencida | Con la sesión abierta, cerrarla desde otra ventana y luego navegar | Vuelve al login con el aviso "Tu sesión expiró. Vuelve a ingresar." | |
| CP-54 | RNF-03 | Intentos repetidos | 5 contraseñas incorrectas seguidas con el mismo correo | El sexto intento (aunque sea correcto) responde que hay demasiados intentos y espera unos minutos | |
| CP-55 | RNF-03 | La contraseña no se guarda | En pgAdmin: `SELECT correo, password_hash FROM usuario;` | La columna muestra un hash `scrypt$...`, nunca la contraseña | |

## Clientes

| ID | Requerimiento | Funcionalidad | Datos utilizados | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| CP-01 | RF-01 | Crear cliente válido | Nombre: Ignacio Paredes Rojas; RUT: 12.345.678-5 | Se guarda, aparece en la lista con el RUT formateado y estado Activo | |
| CP-02 | RF-01, RNF-02 | Crear con RUT inválido | Nombre: Ana Soto; RUT: 12.345.678-9 | No se guarda; el campo RUT muestra "RUT inválido" | |
| CP-03 | RF-01, RNF-05 | Crear con RUT repetido | Nombre: Otra Persona; RUT: 15.432.876-9 (ya existe) | No se guarda; el campo RUT muestra "Ya existe un cliente con ese RUT" | |
| CP-04 | RF-02 | Buscar por nombre | Buscar: "camila" | Aparece solo Camila Fuentes Soto | |
| CP-05 | RF-02 | Buscar por RUT parcial | Buscar: "9.876" | Aparece solo Jorge Riquelme Díaz | |
| CP-06 | RF-03 | Modificar cliente | Editar a Jorge Riquelme Díaz: estado Inactivo | La lista muestra a Jorge como Inactivo | |
| CP-07 | RF-04 | Eliminar cliente | Eliminar a Ignacio Paredes Rojas (creado en CP-01) y confirmar | Desaparece de la lista; aviso "Cliente eliminado." | |
| CP-08 | RF-04 | Cancelar eliminación | Eliminar a Camila Fuentes Soto y presionar Cancelar | Camila sigue en la lista | |
| CP-27 | RF-01, RNF-02 | Nombre con números o símbolos | Nombre: `<script>1234`; RUT: 12.345.678-5 | No se guarda; el campo nombre pide usar solo letras, espacios, punto, guion o apóstrofo | |
| CP-28 | RF-02 | Buscar sin distinguir tildes | Buscar: "tomas" | Aparece Tomás Contreras Vera | |
| CP-29 | RF-02 | Filtrar por estado | Primero dejar a Jorge Riquelme Díaz como Inactivo (CP-06); Estado: Inactivo | Aparece solo Jorge | |
| CP-37 | RF-01 | Historial de reservas del cliente | En la fila de Camila Fuentes Soto, botón "Reservas" | Se abre "Reservas de Camila Fuentes Soto" con todas sus reservas (fecha, servicio, recurso y estado), incluidas las pasadas y las canceladas | |
| CP-38 | RF-01 | Desactivar y activar con un clic | En la fila de Jorge, botón "Desactivar"; luego "Activar" | Pasa a Inactivo y vuelve a Activo; avisos "Cliente desactivado." y "Cliente activado." Un cliente inactivo no aparece al elegir cliente para una reserva | |
| CP-39 | RNF-05 | Dos personas editan al mismo cliente | Abrir "Editar" en Tomás en dos ventanas; guardar un cambio en la primera y luego otro en la segunda | La segunda no pisa el cambio: avisa que otra persona modificó los datos y recarga la lista | |

## Recursos

| ID | Requerimiento | Funcionalidad | Datos utilizados | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| CP-09 | RF-11 | Crear recurso válido | Nombre: Tina de hidromasaje; Tipo: Piscina; Capacidad: 6 | Se guarda y aparece en la lista como Activo | |
| CP-10 | RF-11, RNF-02 | Crear con capacidad 0 | Nombre: Sala 2; Tipo: Sala; Capacidad: 0 | No se guarda; el campo capacidad muestra "entre 1 y 1000" | |
| CP-11 | RF-11, RNF-05 | Crear con nombre repetido | Nombre: sauna seca (en minúsculas); Tipo: Sauna; Capacidad: 4 | No se guarda; el campo nombre muestra "Ya existe un recurso con ese nombre" | |
| CP-12 | RF-12 | Filtrar por tipo y estado | Tipo: Sala; Estado: En mantención | Aparece solo Sala multiuso | |
| CP-13 | RF-13 | Modificar recurso | Editar Sauna seca: capacidad 10 | La lista muestra capacidad 10 | |
| CP-14 | RF-14 | Eliminar recurso | Eliminar Tina de hidromasaje (creada en CP-09) y confirmar | Desaparece de la lista; aviso "Recurso eliminado." | |
| CP-30 | RF-13, RNF-05 | Un recurso con reservas futuras no pasa a mantención | Editar Masoterapeuta turno mañana: estado En mantención | No se guarda; el campo estado indica que tiene reservas futuras y que hay que cancelarlas o reprogramarlas | |
| CP-31 | RF-13, RNF-05 | No bajar la capacidad por debajo de lo reservado | Editar Sauna seca (capacidad 8) a capacidad 1, estando Jorge reservado en ella | No se guarda mientras la ocupación máxima futura supere la capacidad nueva | |

## Reservas

Datos de prueba de mañana: Camila tiene masaje con el masoterapeuta a las 10:00 (confirmada), Jorge tiene sauna a las 11:00 (pendiente de pago) y Valentina tiene piscina a las 16:00 (confirmada).

| ID | Requerimiento | Funcionalidad | Datos utilizados | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| CP-15 | RF-15, RF-16 | Crear reserva válida | Francisca Lagos; Masaje descontracturante; Masoterapeuta turno mañana; mañana 12:00 | Se crea como "Pendiente de pago", 12:00–13:00 | |
| CP-16 | RF-22, RF-24 | Crear sin cupo | Tomás Contreras; Masaje; Masoterapeuta (capacidad 1); mañana 10:30 | No se crea; avisa que no hay cupo y ofrece horarios cercanos con cupo | |
| CP-17 | RF-24 | Usar un horario sugerido | En CP-16, presionar "Usar 11:00" y crear | Se crea la reserva de Tomás a las 11:00 | |
| CP-18 | RF-23 | Consultar horarios con cupo | Nueva reserva; Sesión de sauna; mañana; "Ver horarios con cupo ese día" | Muestra los horarios disponibles; al elegir uno queda en el campo hora | |
| CP-19 | RNF-02 | Hora fuera del horario de atención | Masaje; mañana 20:30 | No se crea; indica que debe empezar a más tardar a las 20:00 | |
| CP-20 | RNF-05 | Cliente con dos reservas a la vez | Camila; Masaje; Sala de masajes 1; mañana 10:00 | No se crea; "El cliente ya tiene otra reserva que se cruza con ese horario" | |
| CP-21 | RF-25 | Registrar pago | Reserva de Jorge (sauna, pendiente) → Registrar pago | Pasa a "Confirmada"; ya no ofrece Eliminar | |
| CP-22 | RF-19 | Reprogramar | Reserva de Jorge → Reprogramar a las 12:00 | Queda 12:00–12:45, sigue confirmada | |
| CP-23 | RF-20 | Cancelar | Reserva de Valentina (confirmada) → Cancelar | Pasa a "Cancelada" y libera el cupo | |
| CP-24 | CRUD | Eliminar una reserva pendiente | Reserva de Tomás (pendiente de pago, pasado mañana 15:00) → Eliminar y confirmar | Desaparece de la lista. Solo las reservas pendientes ofrecen Eliminar | |
| CP-25 | RF-18 | Consultar con filtros | Fecha: mañana; Recurso: Masoterapeuta turno mañana | Solo aparecen Camila, Francisca y Tomás | |
| CP-26 | RNF-05 | Integridad con Clientes | En Clientes, eliminar a Jorge (tiene reservas) | No se elimina; indica que tiene reservas asociadas (409, no un error del sistema) | |
| CP-32 | RF-20 | Cancelar una reserva pendiente de pago | Reserva pendiente de Jorge (antes de pagarla, CP-21) → Cancelar | Pasa a "Cancelada" y queda en el historial. Una reserva cancelada ya no ofrece botones | |
| CP-33 | RF-15 | Elegir cliente con el buscador | Nueva reserva; en Cliente escribir "tom" y elegir "Tomás Contreras Vera" de la lista | Se elige el cliente; solo se ofrecen clientes activos, hasta 10 a la vez | |
| CP-34 | RF-19 | Reprogramar la reserva de un cliente inactivo | Dejar inactiva a Valentina (Clientes); en Reservas, su reserva → Reprogramar → Guardar | Aparece el aviso "El cliente está inactivo. Actívalo en Clientes para poder reprogramar su reserva." | |
| CP-35 | RNF-05 | El pago vence | Crear una reserva y esperar 30 minutos sin pagarla; luego consultar la lista | Pasa sola a "Liberada" y el cupo queda libre para otra persona | |
| CP-36 | RNF-02 | Reserva con más de un año de anticipación | Masaje; fecha dentro de 2 años | No se crea; indica que no se puede reservar con más de un año de anticipación | |
| CP-41 | RF-15, RF-22 | Reserva de grupo | Nueva reserva; Sesión de sauna; Sauna seca (capacidad 8); mañana 14:00; **cantidad de personas: 5** | Se crea y la lista muestra 5 en "Personas". Esa franja deja 3 cupos en la sauna | |
| CP-42 | RF-22, RF-24 | Grupo que no cabe | Otra reserva en la Sauna seca, mañana 14:00, **4 personas** (solo quedan 3) | No se crea; avisa que no hay cupo para 4 personas y sugiere horarios cercanos | |
| CP-43 | RF-22 | Grupo mayor que el recurso | Sauna seca; **9 personas** | No se crea; el campo cantidad dice que el recurso admite hasta 8 personas | |
| CP-44 | RF-23 | Horarios con cupo para un grupo | Sauna; mañana; **6 personas**; "Ver horarios con cupo ese día" | No ofrece el horario de 14:00 (solo quedan 3 cupos) pero sí los libres | |
| CP-45 | RF-19 | Cambiar el tamaño del grupo al reprogramar | Reserva de 5 personas → Reprogramar → cantidad 3 | Queda con 3 personas y libera 2 cupos | |
| CP-40 | RNF-05 | Dos personas actúan sobre la misma reserva | Abrir la lista en dos ventanas; en una cancelar la reserva de Camila; en la otra, intentar Reprogramar o Registrar pago | La segunda avisa que otra persona modificó los datos y recarga; no se hace nada sobre una reserva que ya cambió | |

## Pantalla de Reservas: resumen, agenda y acciones

Con las reservas de demostración creadas para hoy y mañana (o las de los casos CP-15 a CP-45).

| ID | Requerimiento | Funcionalidad | Datos utilizados | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| CP-56 | RNF-06 | Resumen del día | Reservas → Lista | Sobre la tabla aparecen "Reservas de hoy", "Pendientes de pago" y "Próxima de hoy" con cifras coherentes con la lista | |
| CP-57 | RF-18 | Menú de acciones | En una reserva pendiente, abrir "⋯" | Muestra Reprogramar, Cancelar y Eliminar (estas dos en rojo). Con Esc se cierra y el foco vuelve al botón | |
| CP-58 | Plazo de pago | Cuenta regresiva | Crear una reserva y mirar su fila | Dice "Vence en 30 min" y baja con el tiempo; a los 5 minutos o menos se ve en rojo | |
| CP-59 | RF-18, RF-23 | Agenda del día | Presionar "Agenda"; cambiar de día con las flechas y con "Hoy" | Una columna por recurso, las reservas como bloques de color; los grupos que coinciden en un recurso van lado a lado | |
| CP-60 | RF-15 | Reservar desde la agenda | En la agenda, clic en un espacio libre de la Sauna seca a una hora futura | Se abre "Nueva reserva" con ese recurso, la fecha y la hora ya elegidos | |
| CP-61 | RF-20, RF-25 | Detalle desde la agenda | Clic en un bloque pendiente → "Registrar pago" | Se abre el detalle con cliente, servicio, horario y estado; "Registrar pago" pide confirmación y deja la reserva confirmada | |
| CP-62 | RF-08 | Supervisor en la agenda | Ingresar como supervisor; abrir la agenda | Ve las reservas y su detalle, pero sin botones de acción ni clic para crear | |

## Matriz de trazabilidad: requerimiento, implementación y verificación

| Requerimiento | Dónde se implementa | Verificación automática | Caso manual |
|---|---|---|---|
| RF-01 Crear cliente | `src/modulos/clientes/rutas.js` (POST) y `frontend/src/paginas/Clientes.jsx` | Crear cliente; rechazar RUT inválido y nombre vacío | CP-01, CP-02 |
| RF-02 Consultar / buscar clientes | `clientes/repositorio.js` (listar, obtener) | Buscar por nombre; buscar por RUT; consultar un cliente | CP-04, CP-05 |
| RF-03 Modificar cliente | `clientes/rutas.js` (PUT) | Modificar nombre y estado | CP-06 |
| RF-04 Eliminar cliente | `clientes/rutas.js` (DELETE) | Eliminar cliente | CP-07, CP-08 |
| RF-15 / RF-16 Crear reserva | `src/modulos/reservas/servicio.js` (crear) y `frontend/src/paginas/Reservas.jsx` | Crear reserva | CP-15 |
| RF-18 Consultar reservas | `reservas/repositorio.js` (listar con filtros) | Consultar por fecha, recurso y cliente | CP-25 |
| RF-19 Reprogramar | `reservas/servicio.js` (reprogramar) | Reprogramar a otra hora | CP-22 |
| RF-20 Cancelar hasta 2 h antes (pendiente o confirmada) | `reservas/servicio.js` (cancelar), `reservas/reglas.js` (dentroDePlazo) | Cancelar confirmada y pendiente; prueba unitaria del plazo | CP-23, CP-32 |
| Plazo de pago (el informe: "liberar pendientes sin pago") | `reservas/repositorio.js` (liberarVencidas), `PLAZO_PAGO_MIN` en `compartido/catalogos.js` | `test/api.test.js` (plazo vencido) | CP-35 |
| RF-22 Validar capacidad | `reservas/reglas.js` (hayCupo) y bloqueo `FOR UPDATE` en `reservas/repositorio.js` | Rechazar sin cupo; pruebas unitarias de cruces | CP-16 |
| RF-23 Consultar disponibilidad | `GET /api/disponibilidad`, `reservas/reglas.js` (horariosDisponibles) | Consultar horarios con cupo | CP-18 |
| RF-24 Sugerir alternativas | `reservas/reglas.js` (sugerirHorarios) | Sugerencias sin horarios ocupados | CP-16, CP-17 |
| RF-25 Pago para confirmar | `reservas/servicio.js` (registrarPago) | Registrar pago deja confirmada | CP-21 |
| RF-11 Registrar recurso | `src/modulos/recursos/rutas.js` (POST) y `frontend/src/paginas/Recursos.jsx` | Registrar recurso; rechazar capacidad 0 y tipo inexistente | CP-09, CP-10 |
| RF-12 Consultar recursos, estado y capacidad | `recursos/repositorio.js` (listar con filtros) | Filtrar por tipo y estado | CP-12 |
| RF-13 Modificar recurso | `recursos/rutas.js` (PUT) | Modificar capacidad y estado | CP-13 |
| RF-14 Eliminar recurso | `recursos/rutas.js` (DELETE) | Eliminar recurso | CP-14 |
| RNF-02 Validación de datos | `compartido/rut.js`, `src/validaciones.js`, CHECK en `db/schema.sql` | Rechazos de datos inválidos; id inválido responde 404 | CP-02, CP-10 |
| RNF-03 Seguridad | Consultas con parámetros, cabeceras en `src/app.js`, la contraseña nunca sale de la base | Consultar un cliente sin exponer su contraseña | |
| RNF-05 Integridad de datos | UNIQUE y claves foráneas en `db/schema.sql`; bloqueos en transacciones | Rechazar RUT y nombre repetidos; cliente con dos reservas; no borrar cliente con reservas | CP-03, CP-11, CP-20, CP-26 |
| RNF-06 Diseño adaptable | `frontend/src/estilos.css` (la tabla pasa a tarjetas en celular) | | Abrir en el celular o achicar la ventana |
| RNF-08 Arquitectura en capas | Cada módulo: `rutas.js` → `servicio.js` → `repositorio.js` | | Revisión del código |
