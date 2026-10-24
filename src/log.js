// Logs en formato JSON: una línea por evento, fácil de buscar y filtrar.
// Nunca se registran contraseñas, cuerpos de peticiones ni datos personales.
export function log(nivel, mensaje, datos = {}) {
  const linea = JSON.stringify({ hora: new Date().toISOString(), nivel, mensaje, ...datos });
  if (nivel === 'error') console.error(linea);
  else console.log(linea);
}

// Datos de un error para el log. Algunos errores de Node (por ejemplo ECONNREFUSED, cuando
// PostgreSQL no está encendido) traen el mensaje vacío: por eso se registra también el código.
export function datosError(err) {
  return { error: err.message || err.code || err.name, codigo: err.code };
}
