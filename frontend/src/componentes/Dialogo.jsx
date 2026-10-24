// Ventana modal basada en <dialog> del navegador: bloquea el fondo, se cierra con Esc
// y mantiene el foco dentro mientras está abierta.
// Se usa montándola solo cuando debe verse:  {abierto && <Dialogo ... />}
import { useEffect, useRef } from 'react';

export function Dialogo({ id, titulo, pequeno = false, onCerrar, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialogo = ref.current;
    const enfocadoAntes = document.activeElement;
    dialogo.showModal();
    return () => {
      if (dialogo.open) dialogo.close();
      enfocadoAntes?.focus?.(); // al cerrar, el foco vuelve al botón que abrió la ventana
    };
  }, []);

  // El evento "close" llega al presionar Esc. Se revisa que el diálogo esté cerrado de verdad,
  // porque en modo desarrollo React monta los componentes dos veces y genera un "close" de más.
  function alCerrar() {
    if (!ref.current?.open) onCerrar();
  }

  return (
    <dialog
      ref={ref}
      id={id}
      className={pequeno ? 'dialogo dialogo-pequeno' : 'dialogo'}
      aria-labelledby={`${id}-titulo`}
      onClose={alCerrar}
    >
      <h2 id={`${id}-titulo`}>{titulo}</h2>
      {children}
    </dialog>
  );
}

// variante: "peligro" (rojo, para eliminar o cancelar) o "principal" (para confirmar un pago).
export function DialogoConfirmar({ titulo, mensaje, textoBoton, onConfirmar, onCancelar, variante = 'peligro' }) {
  return (
    <Dialogo id="dialogo-confirmar" titulo={titulo} pequeno onCerrar={onCancelar}>
      <p className="confirmar-mensaje">{mensaje}</p>
      <div className="dialogo-acciones">
        <button type="button" className="boton boton-secundario" value="no" onClick={onCancelar}>
          Volver
        </button>
        <button type="button" className={`boton boton-${variante}`} value="si" onClick={onConfirmar}>
          {textoBoton}
        </button>
      </div>
    </Dialogo>
  );
}
