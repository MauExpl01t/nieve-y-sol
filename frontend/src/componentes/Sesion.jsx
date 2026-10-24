// Quién tiene la sesión abierta y qué puede hacer. Las pantallas lo usan para mostrar u ocultar
// botones; el servidor es quien realmente exige el permiso en cada petición.
import { createContext, useContext } from 'react';
import { puede as puedeRol } from '../../../compartido/permisos.js';

export const ContextoSesion = createContext({ usuario: null, puede: () => false });

// Devuelve { usuario, puede(modulo, accion) }. accion: 'leer' o 'escribir'.
export function useSesion() {
  return useContext(ContextoSesion);
}

export function crearSesion(usuario) {
  return { usuario, puede: (modulo, accion) => puedeRol(usuario?.rol, modulo, accion) };
}
