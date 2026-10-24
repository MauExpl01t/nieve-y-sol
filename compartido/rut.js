// Validación de RUT chileno (módulo 11).
// Este archivo lo usan el navegador y el servidor: así la regla vive en un solo lugar.
// El servidor siempre vuelve a validar; la validación del navegador solo ayuda al usuario.

export function calcularDv(cuerpo) {
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

// Acepta "12.345.678-5", "12345678-5" o "123456785".
// Devuelve el RUT normalizado ("12345678-5") o null si no es válido.
export function normalizarRut(texto) {
  if (typeof texto !== 'string') return null;
  const limpio = texto.replace(/[.\s-]/g, '').toUpperCase();
  if (!/^[1-9]\d{6,7}[\dK]$/.test(limpio)) return null;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return calcularDv(cuerpo) === dv ? `${cuerpo}-${dv}` : null;
}

// "12345678-5" -> "12.345.678-5" (solo para mostrar en pantalla).
export function formatearRut(rut) {
  const [cuerpo, dv] = rut.split('-');
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
}
