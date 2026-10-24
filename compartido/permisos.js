// Roles y permisos del sistema (RF-08, RNF-03). Los usa el servidor (para exigirlos en cada ruta)
// y el navegador (para mostrar solo lo que cada persona puede usar). El servidor es quien manda:
// ocultar un botón en pantalla no reemplaza el permiso que se exige en la API.

export const ROLES = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  recepcionista: 'Recepcionista',
  mantenedor: 'Mantenedor',
};

const TODOS = ['administrador', 'supervisor', 'recepcionista', 'mantenedor'];

// Por módulo: quién puede consultar ("leer") y quién puede crear, modificar o eliminar ("escribir").
//  - Administrador: todo.
//  - Recepcionista: gestiona clientes y reservas; consulta recursos y servicios.
//  - Supervisor: solo consulta (supervisión de la operación).
//  - Mantenedor: administra recursos y servicios; no ve clientes ni reservas (datos personales).
export const PERMISOS = {
  clientes: { leer: ['administrador', 'supervisor', 'recepcionista'], escribir: ['administrador', 'recepcionista'] },
  reservas: { leer: ['administrador', 'supervisor', 'recepcionista'], escribir: ['administrador', 'recepcionista'] },
  disponibilidad: { leer: ['administrador', 'supervisor', 'recepcionista'], escribir: [] },
  recursos: { leer: TODOS, escribir: ['administrador', 'mantenedor'] },
  servicios: { leer: TODOS, escribir: ['administrador', 'mantenedor'] },
};

// accion: 'leer' o 'escribir'
export function puede(rol, modulo, accion) {
  return Boolean(PERMISOS[modulo]?.[accion]?.includes(rol));
}

// Secciones de la pantalla, en el orden del menú.
export const SECCIONES = ['reservas', 'clientes', 'recursos'];
