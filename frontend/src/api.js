// Comunicación con la API del backend.
// Si algo falla, lanza ErrorApi con el código que envió el servidor (ej. RUT_DUPLICADO),
// y los errores por campo en "detalles" para marcarlos en el formulario.

export class ErrorApi extends Error {
  constructor(estado, codigo, mensaje, detalles, sugerencias) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
    this.sugerencias = sugerencias; // horarios alternativos cuando no hay cupo (RF-24)
  }
}

export const EVENTO_SESION_VENCIDA = 'nieve-sesion-vencida';

const ESPERA_MAXIMA_MS = 15_000; // si el servidor no responde en 15 s, se muestra un error en vez de cargar sin fin

export async function api(metodo, url, cuerpo, signal) {
  // Se corta por el tiempo máximo o porque quien llamó canceló la petición (signal), lo que ocurra primero.
  const limite = AbortSignal.timeout(ESPERA_MAXIMA_MS);
  let respuesta;
  try {
    respuesta = await fetch(url, {
      method: metodo,
      headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: signal ? AbortSignal.any([signal, limite]) : limite,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err; // petición cancelada a propósito: no es un error para el usuario
    if (err.name === 'TimeoutError') {
      throw new ErrorApi(0, 'SIN_RESPUESTA', 'El servidor tardó demasiado en responder. Intenta nuevamente.');
    }
    throw new ErrorApi(0, 'SIN_CONEXION', 'No se pudo conectar con el servidor. Revisa que esté encendido.');
  }
  if (respuesta.status === 204) return null;
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    // La sesión venció (o se cerró en otra ventana): se avisa a la aplicación para volver al login.
    // Las rutas /api/auth/* no cuentan: ahí un 401 es solo "correo o contraseña incorrectos".
    if (respuesta.status === 401 && !url.startsWith('/api/auth/')) {
      window.dispatchEvent(new Event(EVENTO_SESION_VENCIDA));
    }
    const error = datos?.error;
    throw new ErrorApi(
      respuesta.status,
      error?.codigo ?? 'ERROR',
      error?.mensaje ?? 'Ocurrió un error inesperado. Intenta nuevamente.',
      error?.detalles,
      error?.sugerencias,
    );
  }
  return datos;
}
