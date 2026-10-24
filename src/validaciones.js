// Validación en el borde de la API: todo dato que entra se revisa aquí,
// antes de llegar al servicio o a la base de datos (RNF-02).
import { ErrorApp } from './errores.js';
import { esFechaValida, esHoraDeBloque } from '../compartido/horario.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Un id con formato inválido no puede existir: se responde 404 en vez de un error de BD.
export function leerId(valor, entidad) {
  if (!UUID.test(valor)) throw new ErrorApp(404, 'NO_ENCONTRADO', `${entidad} no existe.`);
  return valor.toLowerCase(); // los ids se comparan en minúsculas en toda la aplicación
}

// Cada lector devuelve { valor } si el dato es válido o { error } con el mensaje para el usuario.
export function leerTexto(valor, { min, max }) {
  if (typeof valor !== 'string') return { error: 'Este campo es obligatorio.' };
  const limpio = valor.trim().replace(/\s+/g, ' ');
  if (limpio.length < min) return { error: `Debe tener al menos ${min} caracteres.` };
  if (limpio.length > max) return { error: `Debe tener como máximo ${max} caracteres.` };
  return { valor: limpio };
}

export function leerEntero(valor, { min, max }) {
  if (!Number.isInteger(valor)) return { error: 'Debe ser un número entero.' };
  if (valor < min || valor > max) return { error: `Debe estar entre ${min} y ${max}.` };
  return { valor };
}

// opciones: objeto { valor: 'Etiqueta' } de compartido/catalogos.js
export function leerOpcion(valor, opciones) {
  if (typeof valor !== 'string' || !Object.hasOwn(opciones, valor)) {
    return { error: `Debe ser una de estas opciones: ${Object.values(opciones).join(', ')}.` };
  }
  return { valor };
}

// Filtro opcional en la URL (?tipo=sauna). Vacío o ausente = sin filtro.
export function leerFiltro(valor, opciones, campo) {
  if (valor === undefined || valor === '') return null;
  const { valor: limpio, error } = leerOpcion(valor, opciones);
  if (error) lanzarSiHayErrores({ [campo]: error });
  return limpio;
}

// Id de otra entidad enviado en el cuerpo (ej. clienteId de una reserva).
export function leerUuid(valor, mensaje) {
  if (typeof valor !== 'string' || !UUID.test(valor)) return { error: mensaje };
  return { valor: valor.toLowerCase() };
}

// Id opcional en la URL (?recursoId=...). Vacío o ausente = sin filtro.
export function leerUuidFiltro(valor, campo) {
  if (valor === undefined || valor === '') return null;
  if (typeof valor !== 'string' || !UUID.test(valor)) lanzarSiHayErrores({ [campo]: 'Identificador inválido.' });
  return valor.toLowerCase();
}

export function leerFecha(valor) {
  if (!esFechaValida(valor)) return { error: 'Elige una fecha válida.' };
  return { valor };
}

export function leerFechaFiltro(valor, campo) {
  if (valor === undefined || valor === '') return null;
  if (!esFechaValida(valor)) lanzarSiHayErrores({ [campo]: 'Usa el formato AAAA-MM-DD.' });
  return valor;
}

export function leerHora(valor) {
  if (!esHoraDeBloque(valor)) return { error: 'Elige una hora en bloques de 15 minutos (ej. 10:00, 10:15).' };
  return { valor };
}

// Versión del registro que vio quien edita (control de ediciones simultáneas). Es opcional: si no
// viene, se guarda sin comprobar; la pantalla siempre la envía. Devuelve { valor } con null si no vino.
export function leerVersionOpcional(valor) {
  if (valor === undefined || valor === null) return { valor: null };
  if (!Number.isInteger(valor) || valor < 1 || valor > 2_147_483_647) {
    return { error: 'La versión debe ser un número entero positivo.' };
  }
  return { valor };
}

export function leerBusqueda(valor) {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim().slice(0, 60);
  return limpio === '' ? null : limpio;
}

// Las listas siempre tienen límite: nunca se devuelve una tabla completa.
export function leerPaginacion(query) {
  const limite = query.limite === undefined ? 50 : Number(query.limite);
  const desde = query.desde === undefined ? 0 : Number(query.desde);
  const errores = {};
  if (!Number.isInteger(limite) || limite < 1 || limite > 100) errores.limite = 'Debe ser un entero entre 1 y 100.';
  if (!Number.isInteger(desde) || desde < 0) errores.desde = 'Debe ser un entero mayor o igual a 0.';
  lanzarSiHayErrores(errores);
  return { limite, desde };
}

export function lanzarSiHayErrores(errores) {
  if (Object.keys(errores).length > 0) {
    throw new ErrorApp(400, 'VALIDACION', 'Revisa los datos marcados.', errores);
  }
}
