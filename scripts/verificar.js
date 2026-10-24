// Verificación automática de requerimientos: Clientes (RF-01 a RF-04), Recursos (RF-11 a RF-14)
// y Reservas con disponibilidad (RF-15, RF-16, RF-18 a RF-20, RF-22 a RF-25).
// Prueba el sistema real (servidor + base de datos) haciendo las mismas peticiones que hace la pantalla.
// Los datos de prueba que crea se borran al final. La excepción son las reservas canceladas:
// se conservan como historial (no se pueden eliminar), así que los clientes de prueba que las
// tienen quedan en estado "inactivo" y no aparecen al elegir un cliente para reservar.
//
// Uso: 1) en una ventana: npm start     2) en otra ventana: npm run verificar
import { calcularDv } from '../compartido/rut.js';
import { aMinutos, aHora } from '../compartido/horario.js';
import { HORARIO } from '../compartido/catalogos.js';

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const creados = { clientes: [], recursos: [], reservas: [] };
let total = 0;
let fallas = 0;

// La API exige sesión: el script inicia sesión como administrador al empezar y reenvía la cookie.
// Usa la persona de demostración; con otras credenciales: VERIFICAR_CORREO y VERIFICAR_CLAVE.
const CORREO = process.env.VERIFICAR_CORREO || 'admin@nieveysol.cl';
const CLAVE = process.env.VERIFICAR_CLAVE || 'Admin#2026';
let cookie = '';

async function pedir(metodo, ruta, cuerpo) {
  const cabeceras = cuerpo ? { 'Content-Type': 'application/json' } : {};
  if (cookie) cabeceras.Cookie = cookie;
  const respuesta = await fetch(BASE + ruta, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);
  return { estado: respuesta.status, datos };
}

function exigir(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

async function verificar(requerimiento, descripcion, prueba) {
  total++;
  try {
    await prueba();
    console.log(`  OK     ${requerimiento.padEnd(13)} ${descripcion}`);
  } catch (err) {
    fallas++;
    console.log(`  FALLA  ${requerimiento.padEnd(13)} ${descripcion}`);
    console.log(`         -> ${err.message}`);
  }
}

// RUT válido al azar (30.000.000 a 39.999.999) para no chocar con datos reales ni de prueba.
function rutDePrueba() {
  const cuerpo = String(30_000_000 + Math.floor(Math.random() * 10_000_000));
  return { cuerpo, dv: calcularDv(cuerpo) };
}

async function verificarClientes() {
  console.log('\nClientes');
  const { cuerpo, dv } = rutDePrueba();
  const rutConPuntos = `${cuerpo.slice(0, 2)}.${cuerpo.slice(2, 5)}.${cuerpo.slice(5)}-${dv}`;
  // Un nombre de persona no lleva números: se escribe el número del RUT con letras (0 = A, 1 = B...).
  const sufijo = cuerpo.replace(/\d/g, (d) => 'ABCDEFGHIJ'[d]);
  const nombre = `Cliente Prueba Automatica ${sufijo}`;
  let cliente;

  await verificar('RF-01', 'Crear cliente con nombre y RUT', async () => {
    const r = await pedir('POST', '/api/clientes', { nombre, rut: rutConPuntos });
    exigir(r.estado === 201, `se esperaba 201 y llegó ${r.estado}`);
    cliente = r.datos;
    creados.clientes.push(cliente.id);
    exigir(cliente.rut === `${cuerpo}-${dv}`, `el RUT no quedó normalizado: ${cliente.rut}`);
    exigir(cliente.estado === 'activo', 'un cliente nuevo debe quedar activo');
  });

  await verificar('RF-01 RNF-02', 'Rechazar RUT con dígito verificador incorrecto', async () => {
    const dvMalo = dv === '0' ? '1' : '0';
    const r = await pedir('POST', '/api/clientes', { nombre: 'Prueba', rut: `${cuerpo}-${dvMalo}` });
    exigir(r.estado === 400 && r.datos?.error?.detalles?.rut, `se esperaba 400 con error en rut y llegó ${r.estado}`);
  });

  await verificar('RF-01 RNF-02', 'Rechazar cliente sin nombre', async () => {
    const r = await pedir('POST', '/api/clientes', { nombre: ' ', rut: '11.111.111-1' });
    exigir(r.estado === 400 && r.datos?.error?.detalles?.nombre, `se esperaba 400 con error en nombre y llegó ${r.estado}`);
  });

  await verificar('RF-01 RNF-02', 'Rechazar un nombre con números o símbolos', async () => {
    const r = await pedir('POST', '/api/clientes', { nombre: '<script>1234', rut: '11.111.111-1' });
    exigir(r.estado === 400 && r.datos?.error?.detalles?.nombre, `se esperaba 400 con error en nombre y llegó ${r.estado}`);
  });

  await verificar('RNF-05', 'Rechazar RUT repetido', async () => {
    const r = await pedir('POST', '/api/clientes', { nombre: 'Otra persona', rut: `${cuerpo}${dv}` });
    if (r.estado === 201) creados.clientes.push(r.datos.id); // si se creó por error, se borra al final
    exigir(r.estado === 409 && r.datos?.error?.codigo === 'RUT_DUPLICADO', `se esperaba 409 RUT_DUPLICADO y llegó ${r.estado}`);
  });

  await verificar('RF-02', 'Buscar cliente por nombre', async () => {
    const r = await pedir('GET', `/api/clientes?buscar=${encodeURIComponent('prueba automatica ' + sufijo)}`);
    exigir(r.estado === 200 && r.datos.datos.some((c) => c.id === cliente?.id), 'el cliente creado no aparece en la búsqueda');
  });

  await verificar('RF-02', 'Buscar cliente por parte del RUT, con puntos', async () => {
    const r = await pedir('GET', `/api/clientes?buscar=${encodeURIComponent(rutConPuntos.slice(0, 6))}`);
    exigir(r.estado === 200 && r.datos.datos.some((c) => c.id === cliente?.id), 'el cliente creado no aparece al buscar por RUT');
  });

  await verificar('RF-02 RNF-03', 'Consultar un cliente sin exponer su contraseña', async () => {
    const r = await pedir('GET', `/api/clientes/${cliente?.id}`);
    exigir(r.estado === 200 && r.datos.nombre === nombre, `se esperaba 200 y llegó ${r.estado}`);
    const campos = Object.keys(r.datos).join(',').toLowerCase();
    exigir(!campos.includes('password'), 'la respuesta incluye un campo de contraseña');
  });

  await verificar('RF-03', 'Modificar nombre y estado del cliente', async () => {
    const r = await pedir('PUT', `/api/clientes/${cliente?.id}`, { nombre: `${nombre} Editado`, rut: `${cuerpo}-${dv}`, estado: 'inactivo' });
    exigir(r.estado === 200, `se esperaba 200 y llegó ${r.estado}`);
    const leido = await pedir('GET', `/api/clientes/${cliente.id}`);
    exigir(leido.datos.estado === 'inactivo' && leido.datos.nombre.endsWith('Editado'), 'el cambio no quedó guardado');
  });

  await verificar('RNF-05', 'Dos personas editan el mismo cliente: la segunda es rechazada', async () => {
    const actual = (await pedir('GET', `/api/clientes/${cliente.id}`)).datos;
    const base = { nombre: actual.nombre, rut: actual.rut, estado: actual.estado, version: actual.version };
    const primera = await pedir('PUT', `/api/clientes/${cliente.id}`, base);
    exigir(primera.estado === 200 && primera.datos.version === actual.version + 1, `la primera edición debía guardarse (${primera.estado})`);
    const segunda = await pedir('PUT', `/api/clientes/${cliente.id}`, base); // con la versión que ya cambió
    exigir(segunda.estado === 409 && segunda.datos?.error?.codigo === 'CONFLICTO_VERSION', `se esperaba 409 CONFLICTO_VERSION y llegó ${segunda.estado}`);
  });

  await verificar('RF-01', 'Historial de reservas de un cliente (todas las fechas y estados)', async () => {
    const r = await pedir('GET', `/api/reservas?clienteId=${cliente.id}&periodo=todas`);
    exigir(r.estado === 200 && Array.isArray(r.datos.datos), `se esperaba 200 con una lista y llegó ${r.estado}`);
    exigir(r.datos.datos.every((x) => x.cliente.id === cliente.id), 'el historial trajo reservas de otros clientes');
  });

  await verificar('RF-04', 'Eliminar cliente', async () => {
    const r = await pedir('DELETE', `/api/clientes/${cliente?.id}`);
    exigir(r.estado === 204, `se esperaba 204 y llegó ${r.estado}`);
    const leido = await pedir('GET', `/api/clientes/${cliente.id}`);
    exigir(leido.estado === 404, 'el cliente sigue existiendo después de eliminarlo');
    creados.clientes = creados.clientes.filter((id) => id !== cliente.id);
  });

  await verificar('RNF-02', 'Un id inválido responde 404, no un error del servidor', async () => {
    const r = await pedir('GET', '/api/clientes/no-es-un-id');
    exigir(r.estado === 404, `se esperaba 404 y llegó ${r.estado}`);
  });
}

async function verificarRecursos() {
  console.log('\nRecursos');
  const nombre = `Recurso Prueba Automatica ${Date.now()}`;
  let recurso;

  await verificar('RF-11', 'Registrar recurso con tipo y capacidad máxima', async () => {
    const r = await pedir('POST', '/api/recursos', { nombre, tipo: 'sala', capacidadMaxima: 4 });
    exigir(r.estado === 201, `se esperaba 201 y llegó ${r.estado}`);
    recurso = r.datos;
    creados.recursos.push(recurso.id);
    exigir(recurso.capacidadMaxima === 4 && recurso.estado === 'activo', 'los datos guardados no coinciden');
  });

  await verificar('RF-11 RNF-02', 'Rechazar capacidad 0', async () => {
    const r = await pedir('POST', '/api/recursos', { nombre: 'Prueba capacidad', tipo: 'sala', capacidadMaxima: 0 });
    exigir(r.estado === 400 && r.datos?.error?.detalles?.capacidadMaxima, `se esperaba 400 con error en capacidad y llegó ${r.estado}`);
  });

  await verificar('RF-11 RNF-02', 'Rechazar un tipo que no existe', async () => {
    const r = await pedir('POST', '/api/recursos', { nombre: 'Prueba tipo', tipo: 'jacuzzi', capacidadMaxima: 2 });
    exigir(r.estado === 400 && r.datos?.error?.detalles?.tipo, `se esperaba 400 con error en tipo y llegó ${r.estado}`);
  });

  await verificar('RNF-05', 'Rechazar nombre repetido (aunque cambien mayúsculas)', async () => {
    const r = await pedir('POST', '/api/recursos', { nombre: nombre.toUpperCase(), tipo: 'sala', capacidadMaxima: 2 });
    if (r.estado === 201) creados.recursos.push(r.datos.id);
    exigir(r.estado === 409 && r.datos?.error?.codigo === 'NOMBRE_DUPLICADO', `se esperaba 409 NOMBRE_DUPLICADO y llegó ${r.estado}`);
  });

  await verificar('RF-13', 'Modificar capacidad y estado del recurso', async () => {
    const r = await pedir('PUT', `/api/recursos/${recurso?.id}`, { nombre, tipo: 'sala', capacidadMaxima: 6, estado: 'en_mantencion' });
    exigir(r.estado === 200 && r.datos.capacidadMaxima === 6 && r.datos.estado === 'en_mantencion', `se esperaba 200 con los cambios y llegó ${r.estado}`);
  });

  await verificar('RF-12', 'Consultar recursos filtrando por tipo y estado', async () => {
    const r = await pedir('GET', '/api/recursos?tipo=sala&estado=en_mantencion');
    exigir(r.estado === 200, `se esperaba 200 y llegó ${r.estado}`);
    exigir(r.datos.datos.every((x) => x.tipo === 'sala' && x.estado === 'en_mantencion'), 'el filtro devolvió recursos que no corresponden');
    exigir(r.datos.datos.some((x) => x.id === recurso?.id), 'el recurso modificado no aparece en el filtro');
  });

  await verificar('RF-14', 'Eliminar recurso', async () => {
    const r = await pedir('DELETE', `/api/recursos/${recurso?.id}`);
    exigir(r.estado === 204, `se esperaba 204 y llegó ${r.estado}`);
    const leido = await pedir('GET', `/api/recursos/${recurso.id}`);
    exigir(leido.estado === 404, 'el recurso sigue existiendo después de eliminarlo');
    creados.recursos = creados.recursos.filter((id) => id !== recurso.id);
  });
}

// Fecha lejana (entre 5 y 11 meses) para no chocar con reservas reales ni de prueba.
// No puede pasar de un año: el sistema no acepta reservas con más anticipación.
function fechaDePrueba() {
  const fecha = new Date();
  fecha.setUTCDate(fecha.getUTCDate() + 150 + Math.floor(Math.random() * 180));
  return fecha.toISOString().slice(0, 10);
}

async function crearClienteTemporal(nombre) {
  const { cuerpo, dv } = rutDePrueba();
  const r = await pedir('POST', '/api/clientes', { nombre, rut: `${cuerpo}-${dv}` });
  if (r.estado !== 201) throw new Error(`no se pudo crear un cliente de prueba (${r.estado})`);
  creados.clientes.push(r.datos.id);
  return r.datos;
}

async function verificarReservas() {
  console.log('\nReservas y disponibilidad');

  // Datos de apoyo: un servicio que tenga un recurso de capacidad 1 y al menos otro recurso.
  const servicios = (await pedir('GET', '/api/servicios')).datos?.datos ?? [];
  const recursos = (await pedir('GET', '/api/recursos?estado=activo&limite=100')).datos?.datos ?? [];
  let servicio, recurso, otroRecurso;
  for (const s of servicios) {
    const propios = recursos.filter((r) => s.recursoIds.includes(r.id));
    const unico = propios.find((r) => r.capacidadMaxima === 1);
    const otro = propios.find((r) => r.id !== unico?.id);
    if (unico && otro) [servicio, recurso, otroRecurso] = [s, unico, otro];
  }
  const ajeno = recursos.find((r) => servicio && !servicio.recursoIds.includes(r.id));
  if (!servicio || !ajeno) {
    total++;
    fallas++;
    console.log('  FALLA  Faltan los datos de prueba de servicios y recursos. Ejecuta "npm run db:seed" (o "npm run db:reiniciar").');
    return;
  }

  const fecha = fechaDePrueba();
  const duracion = servicio.duracionMin;
  const clienteA = await crearClienteTemporal('Cliente Prueba Reserva A');
  const clienteB = await crearClienteTemporal('Cliente Prueba Reserva B');
  const base = { servicioId: servicio.id, recursoId: recurso.id, fecha };
  let reserva;

  await verificar('RF-15 RF-16', `Crear reserva (${servicio.nombre}, ${recurso.nombre})`, async () => {
    const r = await pedir('POST', '/api/reservas', { ...base, clienteId: clienteA.id, hora: '10:00' });
    exigir(r.estado === 201, `se esperaba 201 y llegó ${r.estado}: ${r.datos?.error?.mensaje ?? ''}`);
    reserva = r.datos;
    creados.reservas.push(reserva.id);
    exigir(reserva.estado === 'pendiente_pago', 'una reserva nueva debe quedar pendiente de pago');
    exigir(reserva.horaInicio === '10:00' && reserva.horaFin === aHora(600 + duracion), `horario guardado incorrecto: ${reserva.horaInicio}-${reserva.horaFin}`);
  });

  await verificar('RF-22 RF-24', 'Rechazar reserva sin cupo y sugerir horarios alternativos', async () => {
    const r = await pedir('POST', '/api/reservas', { ...base, clienteId: clienteB.id, hora: '10:00' });
    if (r.estado === 201) creados.reservas.push(r.datos.id);
    exigir(r.estado === 409 && r.datos?.error?.codigo === 'SIN_DISPONIBILIDAD', `se esperaba 409 SIN_DISPONIBILIDAD y llegó ${r.estado}`);
    const sugerencias = r.datos.error.sugerencias ?? [];
    exigir(sugerencias.length > 0, 'no llegaron sugerencias de horario');
    const chocan = sugerencias.filter((h) => aMinutos(h) < 600 + duracion && aMinutos(h) + duracion > 600);
    exigir(chocan.length === 0, `se sugirieron horarios ocupados: ${chocan.join(', ')}`);
  });

  await verificar('RF-23', 'Consultar horarios con cupo de un recurso en una fecha', async () => {
    const q = new URLSearchParams(base);
    const r = await pedir('GET', `/api/disponibilidad?${q}`);
    exigir(r.estado === 200, `se esperaba 200 y llegó ${r.estado}`);
    exigir(!r.datos.horarios.includes('10:00'), 'ofrece las 10:00, que ya están ocupadas');
    exigir(r.datos.horarios.includes(aHora(600 + duracion)), `no ofrece las ${aHora(600 + duracion)}, que están libres`);
  });

  await verificar('RF-22', 'Una reserva de grupo no puede superar la capacidad del recurso', async () => {
    const r = await pedir('POST', '/api/reservas', {
      ...base, recursoId: otroRecurso.id, clienteId: clienteB.id, hora: '17:00',
      cantidadPersonas: otroRecurso.capacidadMaxima + 1,
    });
    exigir(r.estado === 400 && r.datos?.error?.detalles?.cantidadPersonas, `se esperaba 400 con error en cantidadPersonas y llegó ${r.estado}`);
  });

  await verificar('RNF-05', 'Un cliente no puede tener dos reservas a la misma hora', async () => {
    const r = await pedir('POST', '/api/reservas', { ...base, recursoId: otroRecurso.id, clienteId: clienteA.id, hora: '10:00' });
    if (r.estado === 201) creados.reservas.push(r.datos.id);
    exigir(r.estado === 409 && r.datos?.error?.codigo === 'CLIENTE_OCUPADO', `se esperaba 409 CLIENTE_OCUPADO y llegó ${r.estado}`);
  });

  const rechazos = [
    ['hora fuera de bloque de 15 minutos', { hora: '10:10' }, 'hora'],
    ['servicio que termina después del cierre', { hora: aHora(aMinutos(HORARIO.cierre) - duracion + 15) }, 'hora'],
    ['fecha pasada', { fecha: '2020-01-15', hora: '10:00' }, 'fecha'],
    ['recurso que no ofrece el servicio', { recursoId: ajeno.id, hora: '15:00' }, 'recursoId'],
  ];
  for (const [descripcion, cambios, campo] of rechazos) {
    await verificar('RNF-02', `Rechazar ${descripcion}`, async () => {
      const r = await pedir('POST', '/api/reservas', { ...base, clienteId: clienteB.id, ...cambios });
      if (r.estado === 201) creados.reservas.push(r.datos.id);
      exigir(r.estado === 400 && r.datos?.error?.detalles?.[campo], `se esperaba 400 con error en ${campo} y llegó ${r.estado}`);
    });
  }

  await verificar('RF-18', 'Consultar reservas por fecha, recurso y cliente', async () => {
    const porFecha = await pedir('GET', `/api/reservas?fecha=${fecha}&recursoId=${recurso.id}`);
    exigir(porFecha.estado === 200 && porFecha.datos.datos.some((x) => x.id === reserva?.id), 'no aparece al filtrar por fecha y recurso');
    const porCliente = await pedir('GET', `/api/reservas?clienteId=${clienteA.id}`);
    exigir(porCliente.datos.datos.every((x) => x.cliente.id === clienteA.id), 'el filtro por cliente trajo reservas de otros');
    const porNombre = await pedir('GET', `/api/reservas?buscar=${encodeURIComponent(clienteA.nombre)}`);
    exigir(porNombre.datos.datos.some((x) => x.id === reserva?.id), 'no aparece al buscar por nombre del cliente');
  });

  await verificar('RF-25', 'Registrar el pago deja la reserva confirmada', async () => {
    const r = await pedir('POST', `/api/reservas/${reserva?.id}/pago`);
    exigir(r.estado === 200 && r.datos.estado === 'confirmada', `se esperaba 200 confirmada y llegó ${r.estado} ${r.datos?.estado ?? ''}`);
  });

  await verificar('Estados', 'Una reserva confirmada no se puede eliminar', async () => {
    const r = await pedir('DELETE', `/api/reservas/${reserva?.id}`);
    exigir(r.estado === 409 && r.datos?.error?.codigo === 'ESTADO_NO_PERMITE', `se esperaba 409 ESTADO_NO_PERMITE y llegó ${r.estado}`);
  });

  await verificar('RF-13 RNF-05', 'Un recurso con reservas futuras no pasa a mantención', async () => {
    const r = await pedir('PUT', `/api/recursos/${recurso.id}`, {
      nombre: recurso.nombre, tipo: recurso.tipo, capacidadMaxima: recurso.capacidadMaxima, estado: 'en_mantencion',
    });
    if (r.estado === 200) { // no debía pasar: se deja el recurso como estaba
      await pedir('PUT', `/api/recursos/${recurso.id}`, {
        nombre: recurso.nombre, tipo: recurso.tipo, capacidadMaxima: recurso.capacidadMaxima, estado: 'activo',
      });
    }
    exigir(r.estado === 409 && r.datos?.error?.codigo === 'RECURSO_CON_RESERVAS', `se esperaba 409 RECURSO_CON_RESERVAS y llegó ${r.estado}`);
  });

  await verificar('RF-19', 'Reprogramar la reserva a otra hora', async () => {
    const r = await pedir('PUT', `/api/reservas/${reserva?.id}`, { ...base, hora: '12:00' });
    exigir(r.estado === 200 && r.datos.horaInicio === '12:00', `se esperaba 200 a las 12:00 y llegó ${r.estado}: ${r.datos?.error?.mensaje ?? ''}`);
    exigir(r.datos.estado === 'confirmada', 'reprogramar no debe cambiar el estado');
  });

  await verificar('RNF-05', 'Reprogramar con una versión vieja de la reserva es rechazado', async () => {
    const r = await pedir('PUT', `/api/reservas/${reserva?.id}`, { ...base, hora: '12:30', version: 1 });
    exigir(r.estado === 409 && r.datos?.error?.codigo === 'CONFLICTO_VERSION', `se esperaba 409 CONFLICTO_VERSION y llegó ${r.estado}`);
  });

  await verificar('RF-20', 'Cancelar una reserva confirmada (con más de 2 horas de anticipación)', async () => {
    const r = await pedir('POST', `/api/reservas/${reserva?.id}/cancelar`);
    exigir(r.estado === 200 && r.datos.estado === 'cancelada', `se esperaba 200 cancelada y llegó ${r.estado}`);
    const otraVez = await pedir('POST', `/api/reservas/${reserva.id}/cancelar`);
    exigir(otraVez.estado === 409, 'se pudo cancelar dos veces');
  });

  let reservaApoyo;
  await verificar('RNF-05', 'No se puede eliminar un cliente que tiene reservas', async () => {
    const r = await pedir('POST', '/api/reservas', { ...base, clienteId: clienteB.id, hora: '15:00' });
    exigir(r.estado === 201, `no se pudo crear la reserva de apoyo (${r.estado})`);
    reservaApoyo = r.datos;
    creados.reservas.push(r.datos.id);
    const borrar = await pedir('DELETE', `/api/clientes/${clienteB.id}`);
    exigir(borrar.estado === 409 && borrar.datos?.error?.codigo === 'TIENE_DEPENDENCIAS', `se esperaba 409 TIENE_DEPENDENCIAS y llegó ${borrar.estado}`);
  });

  await verificar('Estados', 'Una reserva cancelada no se elimina: queda en el historial', async () => {
    const r = await pedir('DELETE', `/api/reservas/${reserva?.id}`);
    exigir(r.estado === 409 && r.datos?.error?.codigo === 'ESTADO_NO_PERMITE', `se esperaba 409 ESTADO_NO_PERMITE y llegó ${r.estado}`);
    const leida = await pedir('GET', `/api/reservas/${reserva.id}`);
    exigir(leida.estado === 200 && leida.datos.estado === 'cancelada', 'la reserva cancelada debe seguir en el historial');
  });

  await verificar('RF-20', 'Cancelar una reserva pendiente de pago', async () => {
    const r = await pedir('POST', `/api/reservas/${reservaApoyo?.id}/cancelar`);
    exigir(r.estado === 200 && r.datos.estado === 'cancelada', `se esperaba 200 cancelada y llegó ${r.estado}: ${r.datos?.error?.mensaje ?? ''}`);
  });

  await verificar('CRUD', 'Eliminar una reserva pendiente de pago', async () => {
    const creada = await pedir('POST', '/api/reservas', { ...base, clienteId: clienteB.id, hora: '18:00' });
    exigir(creada.estado === 201 && creada.datos.estado === 'pendiente_pago', `no se pudo crear la reserva pendiente (${creada.estado})`);
    const r = await pedir('DELETE', `/api/reservas/${creada.datos.id}`);
    exigir(r.estado === 204, `se esperaba 204 y llegó ${r.estado}`);
    const leida = await pedir('GET', `/api/reservas/${creada.datos.id}`);
    exigir(leida.estado === 404, 'la reserva sigue existiendo');
  });
}

// Se borra lo que haya quedado creado, también si alguna verificación falló a mitad de camino.
// Las reservas pendientes se eliminan; las demás se cancelan y quedan como historial. Un cliente
// con historial no se puede eliminar, así que se deja inactivo.
let clientesDejadosInactivos = 0;
async function limpiar() {
  for (const id of creados.reservas) {
    const r = await pedir('DELETE', `/api/reservas/${id}`).catch(() => null);
    if (r?.estado === 409) await pedir('POST', `/api/reservas/${id}/cancelar`).catch(() => {});
  }
  for (const id of creados.clientes) {
    const r = await pedir('DELETE', `/api/clientes/${id}`).catch(() => null);
    if (r?.estado !== 409) continue;
    const cliente = await pedir('GET', `/api/clientes/${id}`).catch(() => null);
    if (!cliente?.datos) continue;
    const { nombre, rut } = cliente.datos;
    await pedir('PUT', `/api/clientes/${id}`, { nombre, rut, estado: 'inactivo' }).catch(() => {});
    clientesDejadosInactivos++;
  }
  for (const id of creados.recursos) await pedir('DELETE', `/api/recursos/${id}`).catch(() => {});
}

try {
  const salud = await pedir('GET', '/api/salud');
  if (salud.estado !== 200) {
    console.error('El servidor responde, pero no logra conectarse a la base de datos. Revisa PostgreSQL y el archivo .env.');
    process.exit(1);
  }
} catch {
  console.error(`No hay servidor en ${BASE}. Ejecuta "npm start" en otra ventana y vuelve a intentar.`);
  process.exit(1);
}

console.log(`Verificando el sistema en ${BASE}`);

// Inicio de sesión: sin él, ninguna otra ruta responde.
{
  const respuesta = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: CORREO, password: CLAVE }),
  });
  if (respuesta.status !== 200) {
    console.error(`No se pudo iniciar sesión como ${CORREO} (${respuesta.status}). Con otro usuario: VERIFICAR_CORREO y VERIFICAR_CLAVE.`);
    process.exit(1);
  }
  cookie = respuesta.headers.get('set-cookie').split(';')[0];
}

console.log('\nAutenticación');
await verificar('RNF-03', 'Sin sesión la API rechaza las peticiones (401)', async () => {
  const r = await fetch(`${BASE}/api/clientes`);
  exigir(r.status === 401, `se esperaba 401 y llegó ${r.status}`);
});
await verificar('RNF-03', 'Una contraseña incorrecta no abre sesión', async () => {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: CORREO, password: 'clave-equivocada' }),
  });
  exigir(r.status === 401, `se esperaba 401 y llegó ${r.status}`);
});
await verificar('RNF-03', 'Con la sesión abierta se identifica a la persona', async () => {
  const r = await pedir('GET', '/api/auth/yo');
  exigir(r.estado === 200 && r.datos.usuario.correo === CORREO, `se esperaba 200 con el usuario y llegó ${r.estado}`);
  exigir(!JSON.stringify(r.datos).includes('password'), 'la respuesta no debe incluir la contraseña');
});

try {
  await verificarClientes();
  await verificarRecursos();
  await verificarReservas();
} finally {
  await limpiar();
}
if (clientesDejadosInactivos > 0) {
  console.log(`\nNota: ${clientesDejadosInactivos} cliente(s) de prueba quedaron inactivos porque tienen reservas canceladas, que se conservan como historial.`);
}
console.log(`\nResultado: ${total - fallas} de ${total} verificaciones correctas.`);
process.exitCode = fallas > 0 ? 1 : 0;
