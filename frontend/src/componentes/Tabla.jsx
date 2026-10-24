// Piezas comunes de las tablas de Clientes, Recursos y Reservas.
import { MenuAcciones } from './Menu.jsx';
import { IconoVacio } from './Iconos.jsx';

export function EtiquetaEstado({ valor, etiquetas }) {
  return <span className={`estado estado-${valor}`}>{etiquetas[valor] ?? valor}</span>;
}

// Acciones de una fila. Cada botón aparece solo si la pantalla pasa su función: así una persona sin
// permiso de modificar (por ejemplo, el Supervisor) ve únicamente "Reservas", o nada.
// Lo habitual queda a la vista (Reservas, Editar); activar/desactivar y eliminar van en el menú "⋯".
export function Acciones({ nombre, estado, onVerReservas, onEditar, onAlternarEstado, onEliminar }) {
  const textoEstado = estado === 'inactivo' ? 'Activar' : 'Desactivar';
  const menu = [];
  if (onAlternarEstado) menu.push({ texto: textoEstado, onClick: onAlternarEstado, accion: 'alternarEstado' });
  if (onEliminar) menu.push({ texto: 'Eliminar', onClick: onEliminar, accion: 'eliminar', peligro: true, separador: menu.length > 0 });
  return (
    <td className="acciones">
      <div className="acciones-lista">
        {onVerReservas && (
          <button type="button" className="boton-texto" aria-label={`Ver reservas de ${nombre}`} onClick={onVerReservas}>
            Reservas
          </button>
        )}
        {onEditar && (
          <button type="button" className="boton boton-chico boton-secundario" aria-label={`Editar ${nombre}`} onClick={onEditar}>
            Editar
          </button>
        )}
        {menu.length > 0 && <MenuAcciones items={menu} contexto={nombre} />}
      </div>
    </td>
  );
}

// Filas "esqueleto" mientras llega la primera carga: la tabla ya muestra su forma.
export function FilasCarga({ columnas, filas = 5 }) {
  return Array.from({ length: filas }, (_, i) => (
    <tr key={i} className="fila-esqueleto" aria-hidden="true">
      <td colSpan={columnas}>
        <div className="esqueleto-fila">
          <span className="esqueleto esqueleto-largo" />
          <span className="esqueleto esqueleto-medio" />
          <span className="esqueleto esqueleto-corto" />
        </div>
      </td>
    </tr>
  ));
}

// Debajo de la tabla: el error de carga (con botón para reintentar) o el mensaje de lista vacía.
// Un error de carga nunca se muestra como "no hay datos": son situaciones distintas.
// accion: { texto, onClick } opcional, un botón para salir de la lista vacía (ej. "Nueva reserva").
export function MensajeLista({ cargando, error, cantidad, mensajeVacio, onReintentar, accion }) {
  if (error) {
    return (
      <div className="tabla-vacia tabla-error" role="alert">
        <p>No se pudo cargar la lista. {error}</p>
        <button type="button" className="boton boton-secundario" onClick={onReintentar}>Reintentar</button>
      </div>
    );
  }
  if (!cargando && cantidad === 0) {
    return (
      <div className="tabla-vacia">
        <span className="vacio-icono"><IconoVacio /></span>
        <p>{mensajeVacio}</p>
        {accion && (
          <button type="button" className="boton boton-principal" onClick={accion.onClick}>{accion.texto}</button>
        )}
      </div>
    );
  }
  return null;
}

// Pide la página siguiente cuando hay más de 50 resultados.
export function VerMas({ hayMas, cargando, onClick }) {
  if (!hayMas) return null;
  return (
    <div className="ver-mas">
      <button type="button" className="boton boton-secundario" onClick={onClick} disabled={cargando}>
        {cargando ? 'Cargando…' : 'Ver más resultados'}
      </button>
    </div>
  );
}
