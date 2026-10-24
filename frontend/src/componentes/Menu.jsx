// Menú de acciones de una fila ("⋯"): deja a la vista solo lo habitual y guarda lo demás,
// con lo destructivo (cancelar, eliminar) al final y en rojo.
//
// La lista se posiciona con "fixed" para que la tabla (que tiene scroll) no la recorte.
// Teclado: Enter/Espacio abre, ↑ ↓ mueven, Esc cierra y devuelve el foco al botón.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { IconoMas } from './Iconos.jsx';

// items: [{ texto, onClick, peligro?, accion?, separador? }]
// contexto: sobre qué actúa (ej. el nombre del cliente), para el nombre accesible de cada opción.
export function MenuAcciones({ items, contexto }) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState({ top: 0, right: 0, visible: false });
  const boton = useRef(null);
  const lista = useRef(null);
  const idLista = useId();

  function cerrar(devolverFoco = false) {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus();
  }

  // Posición: debajo del botón, o encima si abajo no cabe.
  useLayoutEffect(() => {
    if (!abierto) return;
    const caja = boton.current.getBoundingClientRect();
    const alto = lista.current.offsetHeight;
    const cabeAbajo = caja.bottom + 6 + alto <= window.innerHeight - 8;
    setPosicion({
      top: cabeAbajo ? caja.bottom + 6 : Math.max(8, caja.top - 6 - alto),
      right: Math.max(8, window.innerWidth - caja.right),
      visible: true,
    });
  }, [abierto]);

  // El foco pasa a la primera opción cuando la lista ya es visible (un elemento oculto no recibe foco).
  useEffect(() => {
    if (abierto && posicion.visible) lista.current?.querySelector('button')?.focus();
  }, [abierto, posicion.visible]);

  // Cierra al hacer clic afuera, al hacer scroll o al cambiar el tamaño de la ventana.
  useEffect(() => {
    if (!abierto) return undefined;
    function afuera(evento) {
      if (!lista.current?.contains(evento.target) && !boton.current?.contains(evento.target)) cerrar();
    }
    const alMover = () => cerrar();
    document.addEventListener('pointerdown', afuera);
    window.addEventListener('scroll', alMover, true);
    window.addEventListener('resize', alMover);
    return () => {
      document.removeEventListener('pointerdown', afuera);
      window.removeEventListener('scroll', alMover, true);
      window.removeEventListener('resize', alMover);
    };
  }, [abierto]);

  function alTeclear(evento) {
    const opciones = [...lista.current.querySelectorAll('button')];
    const actual = opciones.indexOf(document.activeElement);
    if (evento.key === 'Escape') {
      evento.preventDefault();
      cerrar(true);
    } else if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      opciones[(actual + 1) % opciones.length].focus();
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      opciones[(actual - 1 + opciones.length) % opciones.length].focus();
    } else if (evento.key === 'Tab') {
      cerrar();
    }
  }

  return (
    <>
      <button
        ref={boton}
        type="button"
        className="boton-icono"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? idLista : undefined}
        aria-label={contexto ? `Más acciones: ${contexto}` : 'Más acciones'}
        onClick={() => {
          setPosicion((p) => ({ ...p, visible: false }));
          setAbierto((a) => !a);
        }}
      >
        <IconoMas />
      </button>
      {abierto && (
        <div
          ref={lista}
          id={idLista}
          className="menu"
          role="menu"
          style={{ top: posicion.top, right: posicion.right, visibility: posicion.visible ? 'visible' : 'hidden' }}
          onKeyDown={alTeclear}
        >
          {items.map((item) => (
            <button
              key={item.accion ?? item.texto}
              type="button"
              role="menuitem"
              className={`menu-item${item.peligro ? ' peligro' : ''}${item.separador ? ' con-separador' : ''}`}
              data-accion={item.accion}
              aria-label={contexto ? `${item.texto}: ${contexto}` : undefined}
              onClick={() => {
                cerrar();
                item.onClick();
              }}
            >
              {item.texto}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
