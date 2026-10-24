// Pantalla de Recursos: listar y filtrar (RF-12), crear (RF-11), editar (RF-13) y eliminar (RF-14).
import { useEffect, useRef, useState } from 'react';
import { api, ErrorApi } from '../api.js';
import { useAvisos } from '../componentes/Avisos.jsx';
import { useListado, useValorRetrasado } from '../hooks/useListado.js';
import { Dialogo, DialogoConfirmar } from '../componentes/Dialogo.jsx';
import { CampoTexto, CampoSelect, FiltroSelect, enfocarPrimerError } from '../componentes/Campos.jsx';
import { EtiquetaEstado, Acciones, MensajeLista, VerMas, FilasCarga } from '../componentes/Tabla.jsx';
import { useSesion } from '../componentes/Sesion.jsx';
import { TIPOS_RECURSO, ESTADOS_RECURSO, NOMBRE, CAPACIDAD } from '../../../compartido/catalogos.js';

export default function Recursos({ moverFoco }) {
  const avisar = useAvisos();
  const escribe = useSesion().puede('recursos', 'escribir'); // crear, modificar y eliminar
  const titulo = useRef(null);
  const [buscar, setBuscar] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const busqueda = useValorRetrasado(buscar.trim());
  const { datos, hayMas, cargando, cargandoMas, error, recargar, cargarMas } = useListado('/api/recursos', {
    buscar: busqueda, tipo, estado,
  });
  const hayFiltros = Boolean(busqueda || tipo || estado);

  const [formulario, setFormulario] = useState(null);
  const [porEliminar, setPorEliminar] = useState(null);

  useEffect(() => {
    if (moverFoco) titulo.current.focus();
  }, [moverFoco]);

  async function eliminar() {
    const recurso = porEliminar;
    setPorEliminar(null);
    try {
      await api('DELETE', `/api/recursos/${recurso.id}`);
      avisar('Recurso eliminado.');
      recargar();
    } catch (err) {
      avisar(err.message, 'error');
    }
  }

  return (
    <section id="vista-recursos" className="vista" aria-labelledby="titulo-recursos" aria-busy={cargando || undefined}>
      <header className="vista-cabecera">
        <div>
          <h1 id="titulo-recursos" ref={titulo} tabIndex={-1}>Recursos</h1>
          <p className="vista-descripcion">Salas, sauna, piscinas y personal que los servicios necesitan para funcionar.</p>
        </div>
        {escribe && (
          <button type="button" className="boton boton-principal" data-accion="nuevo" onClick={() => setFormulario({ recurso: null })}>
            Nuevo recurso
          </button>
        )}
      </header>

      <div className="barra-filtros">
        <div className="campo campo-busqueda">
          <label htmlFor="buscar-recursos">Buscar por nombre</label>
          <input
            id="buscar-recursos"
            type="search"
            autoComplete="off"
            placeholder="Ej: sauna"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </div>
        <FiltroSelect id="filtro-tipo" etiqueta="Tipo" valor={tipo} onCambio={setTipo} opciones={TIPOS_RECURSO} />
        <FiltroSelect id="filtro-estado" etiqueta="Estado" valor={estado} onCambio={setEstado} opciones={ESTADOS_RECURSO} />
      </div>

      <div className="tabla-contenedor">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Tipo</th>
              <th scope="col" className="numero">Capacidad máxima</th>
              <th scope="col">Estado</th>
              <th scope="col"><span className="solo-lector">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {cargando && datos.length === 0 && <FilasCarga columnas={5} />}
            {datos.map((recurso) => (
              <tr key={recurso.id}>
                <td className="titulo">{recurso.nombre}</td>
                <td data-etiqueta="Tipo">{TIPOS_RECURSO[recurso.tipo] ?? recurso.tipo}</td>
                <td className="numero" data-etiqueta="Capacidad máxima">{recurso.capacidadMaxima}</td>
                <td data-etiqueta="Estado"><EtiquetaEstado valor={recurso.estado} etiquetas={ESTADOS_RECURSO} /></td>
                <Acciones
                  nombre={recurso.nombre}
                  onEditar={escribe ? () => setFormulario({ recurso }) : undefined}
                  onEliminar={escribe ? () => setPorEliminar(recurso) : undefined}
                />
              </tr>
            ))}
          </tbody>
        </table>
        <MensajeLista
          cargando={cargando}
          error={error}
          cantidad={datos.length}
          onReintentar={recargar}
          mensajeVacio={hayFiltros ? 'Ningún recurso coincide con la búsqueda o los filtros.' : 'Aún no hay recursos registrados.'}
          accion={escribe && !hayFiltros ? { texto: 'Nuevo recurso', onClick: () => setFormulario({ recurso: null }) } : undefined}
        />
      </div>
      <VerMas hayMas={hayMas} cargando={cargandoMas} onClick={cargarMas} />

      {formulario && (
        <FormularioRecurso
          recurso={formulario.recurso}
          onCerrar={() => setFormulario(null)}
          onGuardado={(mensaje) => {
            setFormulario(null);
            avisar(mensaje);
            recargar();
          }}
        />
      )}

      {porEliminar && (
        <DialogoConfirmar
          titulo={`¿Eliminar «${porEliminar.nombre}»?`}
          mensaje="Esta acción no se puede deshacer. Si el recurso ya tiene reservas, márcalo como inactivo o en mantención."
          textoBoton="Eliminar recurso"
          onConfirmar={eliminar}
          onCancelar={() => setPorEliminar(null)}
        />
      )}
    </section>
  );
}

function validar(datos) {
  const errores = {};
  if (datos.nombre.length < NOMBRE.min) errores.nombre = `Debe tener al menos ${NOMBRE.min} caracteres.`;
  if (!datos.tipo) errores.tipo = 'Elige un tipo.';
  const { capacidadMaxima: c } = datos;
  if (!Number.isInteger(c) || c < CAPACIDAD.min || c > CAPACIDAD.max) {
    errores.capacidadMaxima = `Debe ser un número entero entre ${CAPACIDAD.min} y ${CAPACIDAD.max}.`;
  }
  return errores;
}

function FormularioRecurso({ recurso, onCerrar, onGuardado }) {
  const avisar = useAvisos();
  const formularioRef = useRef(null);
  const esEdicion = recurso !== null;
  const [nombre, setNombre] = useState(recurso?.nombre ?? '');
  const [tipo, setTipo] = useState(recurso?.tipo ?? '');
  const [capacidad, setCapacidad] = useState(recurso ? String(recurso.capacidadMaxima) : '');
  const [estado, setEstado] = useState(recurso?.estado ?? 'activo');
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    enfocarPrimerError(formularioRef.current);
  }, [errores]);

  async function guardar(evento) {
    evento.preventDefault();
    const datos = {
      nombre: nombre.trim(),
      tipo,
      capacidadMaxima: capacidad === '' ? null : Number(capacidad),
    };
    if (esEdicion) datos.estado = estado;

    const erroresLocales = validar(datos);
    setErrores(erroresLocales);
    if (Object.keys(erroresLocales).length > 0) return;

    setGuardando(true);
    try {
      if (esEdicion) await api('PUT', `/api/recursos/${recurso.id}`, datos);
      else await api('POST', '/api/recursos', datos);
      onGuardado(esEdicion ? 'Recurso actualizado.' : 'Recurso creado.');
    } catch (err) {
      setGuardando(false);
      if (err instanceof ErrorApi && err.detalles) setErrores(err.detalles);
      else avisar(err.message, 'error');
    }
  }

  return (
    <Dialogo id="dialogo-recurso" titulo={esEdicion ? 'Editar recurso' : 'Nuevo recurso'} onCerrar={onCerrar}>
      <form ref={formularioRef} noValidate onSubmit={guardar}>
        <CampoTexto
          id="recurso-nombre" nombre="nombre" etiqueta="Nombre" placeholder="Ej: Sauna seca"
          valor={nombre} onCambio={setNombre} error={errores.nombre} maxLength={NOMBRE.max}
        />
        <CampoSelect
          id="recurso-tipo" nombre="tipo" etiqueta="Tipo" opcionVacia="Elige un tipo"
          valor={tipo} onCambio={setTipo} opciones={TIPOS_RECURSO} error={errores.tipo}
        />
        <CampoTexto
          id="recurso-capacidad" nombre="capacidadMaxima" etiqueta="Capacidad máxima de personas"
          type="number" inputMode="numeric" min={CAPACIDAD.min} max={CAPACIDAD.max} step={1}
          valor={capacidad} onCambio={setCapacidad} error={errores.capacidadMaxima}
        />
        {esEdicion && (
          <CampoSelect
            id="recurso-estado" nombre="estado" etiqueta="Estado"
            valor={estado} onCambio={setEstado} opciones={ESTADOS_RECURSO} error={errores.estado}
          />
        )}
        <div className="dialogo-acciones">
          <button type="button" className="boton boton-secundario" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="boton boton-principal" disabled={guardando}>Guardar recurso</button>
        </div>
      </form>
    </Dialogo>
  );
}
