// Formatos para mostrar datos en pantalla (Chile).

// "2026-10-08" -> "jue 08 oct". Se arma con los números para no depender de la zona del navegador.
export function formatearFecha(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(a, m - 1, d)
    .toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' })
    .replace(/\./g, '')
    .replace(',', '');
}

// "2026-10-08" -> "jueves 8 de octubre"
export function formatearFechaLarga(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatearPrecio(pesos) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(pesos);
}

// Fecha de hoy en el computador del usuario, en formato "AAAA-MM-DD".
export function hoy() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

// "2026-10-08" + 1 = "2026-10-09". Se calcula en UTC para que el horario de verano no corra el día.
export function sumarDias(fecha, dias) {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

// "Hoy", "Mañana" o la fecha corta ("vie 16 oct"). La fecha corta completa a "Hoy" y "Mañana" en detalle.
export function etiquetaFecha(fecha) {
  const hoyTexto = hoy();
  if (fecha === hoyTexto) return 'Hoy';
  if (fecha === sumarDias(hoyTexto, 1)) return 'Mañana';
  return formatearFecha(fecha);
}

// "Camila Gómez Rojas" -> "CG": para el círculo con las iniciales de la persona.
export function iniciales(nombre) {
  const palabras = String(nombre ?? '').trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '?';
  const primera = palabras[0][0];
  const segunda = palabras.length > 1 ? palabras[1][0] : '';
  return (primera + segunda).toUpperCase();
}
