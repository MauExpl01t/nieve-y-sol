// Campos de formulario con etiqueta, texto de ayuda y mensaje de error accesibles.
// Cada campo usa el id "<id>-error" para su mensaje, y aria-invalid cuando hay error.

function descripcion(id, ayuda) {
  return ayuda ? `${id}-ayuda ${id}-error` : `${id}-error`;
}

export function CampoTexto({ id, nombre, etiqueta, valor, onCambio, error, ayuda, ...resto }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        name={nombre}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={descripcion(id, ayuda)}
        autoComplete="off"
        {...resto}
      />
      {ayuda && <p className="campo-ayuda" id={`${id}-ayuda`}>{ayuda}</p>}
      <p className="campo-error" id={`${id}-error`}>{error}</p>
    </div>
  );
}

// opciones: objeto { valor: 'Etiqueta' } de compartido/catalogos.js
export function CampoSelect({ id, nombre, etiqueta, valor, onCambio, opciones, error, opcionVacia, ayuda, ...resto }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <select
        id={id}
        name={nombre}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={descripcion(id, ayuda)}
        {...resto}
      >
        {opcionVacia && <option value="">{opcionVacia}</option>}
        {Object.entries(opciones).map(([clave, texto]) => (
          <option key={clave} value={clave}>{texto}</option>
        ))}
      </select>
      {ayuda && <p className="campo-ayuda" id={`${id}-ayuda`}>{ayuda}</p>}
      <p className="campo-error" id={`${id}-error`}>{error}</p>
    </div>
  );
}

// Selector de filtro para las listas ("Todos" = sin filtro). opciones: objeto { valor: 'Etiqueta' }
export function FiltroSelect({ id, etiqueta, valor, onCambio, opciones }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <select id={id} value={valor} onChange={(e) => onCambio(e.target.value)}>
        <option value="">Todos</option>
        {Object.entries(opciones).map(([clave, texto]) => (
          <option key={clave} value={clave}>{texto}</option>
        ))}
      </select>
    </div>
  );
}

// Lleva el foco al primer campo con error, para que el usuario sepa qué corregir.
export function enfocarPrimerError(formulario) {
  formulario?.querySelector('[aria-invalid="true"]')?.focus();
}
