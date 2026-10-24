// Avisos flotantes ("Cliente creado.", errores). Cualquier componente los usa con useAvisos().
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { IconoOk, IconoAlerta } from './Iconos.jsx';

const ContextoAvisos = createContext(() => {});

export function ProveedorAvisos({ children }) {
  const [avisos, setAvisos] = useState([]);
  const siguienteId = useRef(0);

  const avisar = useCallback((texto, tipo = 'exito') => {
    const id = ++siguienteId.current;
    setAvisos((lista) => [...lista, { id, texto, tipo }]);
    setTimeout(() => {
      setAvisos((lista) => lista.filter((aviso) => aviso.id !== id));
    }, tipo === 'error' ? 7000 : 4000);
  }, []);

  return (
    <ContextoAvisos.Provider value={avisar}>
      {children}
      <div id="avisos" className="avisos" role="status" aria-live="polite">
        {avisos.map((aviso) => (
          // Los errores usan role="alert": el lector de pantalla los anuncia de inmediato.
          <div
            key={aviso.id}
            className={aviso.tipo === 'error' ? 'aviso aviso-error' : 'aviso aviso-exito'}
            role={aviso.tipo === 'error' ? 'alert' : undefined}
          >
            {aviso.tipo === 'error' ? <IconoAlerta /> : <IconoOk />}
            <span>{aviso.texto}</span>
          </div>
        ))}
      </div>
    </ContextoAvisos.Provider>
  );
}

export function useAvisos() {
  return useContext(ContextoAvisos);
}
