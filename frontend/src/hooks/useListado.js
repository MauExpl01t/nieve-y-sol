// Carga una lista desde la API cada vez que cambian los filtros.
// Si llega una búsqueda nueva, cancela la anterior: así una respuesta lenta no pisa a una más reciente.
// "cargarMas" pide la página siguiente (parámetro "desde") y la agrega al final de la lista.
// "error" trae el mensaje cuando la lista no se pudo cargar: no es lo mismo que una lista vacía.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAvisos } from '../componentes/Avisos.jsx';

export function useListado(url, filtros) {
  const avisar = useAvisos();
  const [estado, setEstado] = useState({ datos: [], hayMas: false, cargando: true, error: null });
  const [cargandoMas, setCargandoMas] = useState(false);
  const [version, setVersion] = useState(0);
  const cargados = useRef(0); // cuántos registros hay en pantalla: de ahí parte la página siguiente
  const controlMas = useRef(null);

  const parametros = new URLSearchParams({ limite: '50' });
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor) parametros.set(clave, valor);
  }
  const consulta = parametros.toString();

  useEffect(() => {
    const control = new AbortController();
    controlMas.current?.abort(); // un "ver más" en curso ya no corresponde a esta consulta
    setCargandoMas(false);
    setEstado((anterior) => ({ ...anterior, cargando: true, error: null }));
    api('GET', `${url}?${consulta}`, undefined, control.signal)
      .then(({ datos, hayMas }) => {
        cargados.current = datos.length;
        setEstado({ datos, hayMas, cargando: false, error: null });
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setEstado((anterior) => ({ ...anterior, cargando: false, error: err.message }));
      });
    return () => control.abort();
  }, [url, consulta, version]);

  // Para volver a cargar después de crear, editar o eliminar.
  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  const cargarMas = useCallback(() => {
    const control = new AbortController();
    controlMas.current = control;
    setCargandoMas(true);
    api('GET', `${url}?${consulta}&desde=${cargados.current}`, undefined, control.signal)
      .then(({ datos, hayMas }) => {
        cargados.current += datos.length;
        setEstado((anterior) => ({ ...anterior, datos: [...anterior.datos, ...datos], hayMas }));
        setCargandoMas(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        avisar(err.message, 'error');
        setCargandoMas(false);
      });
  }, [url, consulta, avisar]);

  return { ...estado, cargandoMas, recargar, cargarMas };
}

// Devuelve el valor recién cuando deja de cambiar por "ms" milisegundos.
// Se usa en los buscadores: se consulta cuando el usuario deja de escribir, no letra por letra.
export function useValorRetrasado(valor, ms = 300) {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const espera = setTimeout(() => setRetrasado(valor), ms);
    return () => clearTimeout(espera);
  }, [valor, ms]);
  return retrasado;
}
