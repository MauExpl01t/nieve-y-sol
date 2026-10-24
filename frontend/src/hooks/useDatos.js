// Carga datos de apoyo una vez (ej. la lista de servicios para un selector).
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAvisos } from '../componentes/Avisos.jsx';

export function useDatos(url) {
  const avisar = useAvisos();
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    const control = new AbortController();
    api('GET', url, undefined, control.signal)
      .then((respuesta) => setDatos(respuesta.datos))
      .catch((err) => {
        if (err.name !== 'AbortError') avisar(err.message, 'error');
      });
    return () => control.abort();
  }, [url, avisar]);

  return datos; // null mientras carga
}
