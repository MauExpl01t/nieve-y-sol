// Pantalla de Clientes: listar y buscar (RF-02), crear (RF-01), editar (RF-03), desactivar,
// eliminar (RF-04) y consultar el historial de reservas de cada cliente.
import { useEffect, useRef, useState } from 'react';
import { api, ErrorApi } from '../api.js';
import { useAvisos } from '../componentes/Avisos.jsx';
import { useListado, useValorRetrasado } from '../hooks/useListado.js';
import { Dialogo, DialogoConfirmar } from '../componentes/Dialogo.jsx';
import { CampoTexto, CampoSelect, FiltroSelect, enfocarPrimerError } from '../componentes/Campos.jsx';
import { EtiquetaEstado, Acciones, MensajeLista, VerMas, FilasCarga } from '../componentes/Tabla.jsx';
import { normalizarRut, formatearRut } from '../../../compartido/rut.js';
import { nombrePersonaValido, MENSAJE_NOMBRE_PERSONA } from '../../../compartido/texto.js';
import { ESTADOS_CLIENTE, ESTADOS_RESERVA, NOMBRE } from '../../../compartido/catalogos.js';
import { formatearFecha } from '../formato.js';
import { useSesion } from '../componentes/Sesion.jsx';

export default function Clientes({ moverFoco }) {
  const avisar = useAvisos();
  const { puede } = useSesion();
  const escribe = puede('clientes', 'escribir'); // crear, modificar, desactivar y eliminar
  const veReservas = puede('reservas', 'leer'); // para el historial de cada cliente
  const titulo = useRef(null);
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('');
  const busqueda = useValorRetrasado(buscar.trim());
  const { datos, hayMas, cargando, cargandoMas, error, recargar, cargarMas } = useListado('/api/clientes', {
    buscar: busqueda,
    estado,
  });

  // formulario: null = cerrado | { cliente: null } = nuevo | { cliente } = editar
  const [formulario, setFormulario] = useState(null);
  const [porEliminar, setPorEliminar] = useState(null);
  const [historialDe, setHistorialDe] = useState(null); // cliente cuyo historial de reservas se muestra

  useEffect(() => {
    if (moverFoco) titulo.current.focus();
  }, [moverFoco]);

  // Desactivar conserva el historial de reservas (RF-01); activar lo deja disponible para reservar.
  async function alternarEstado(cliente) {
    const nuevoEstado = cliente.estado === 'inactivo' ? 'activo' : 'inactivo';
    try {
      await api('PUT', `/api/clientes/${cliente.id}`, {
        nombre: cliente.nombre, rut: cliente.rut, estado: nuevoEstado, version: cliente.version,
      });
      avisar(nuevoEstado === 'activo' ? 'Cliente activado.' : 'Cliente desactivado.');
    } catch (err) {
      avisar(err.message, 'error');
    }
    recargar();
    titulo.current?.focus();
  }

  async function eliminar() {
    const cliente = porEliminar;
    setPorEliminar(null);
    try {
      await api('DELETE', `/api/clientes/${cliente.id}`);
      avisar('Cliente eliminado.');
      recargar();
    } catch (err) {
      avisar(err.message, 'error');
    }
  }

  return (
    <section id="vista-clientes" className="vista" aria-labelledby="titulo-clientes" aria-busy={cargando || undefined}>
      <header className="vista-cabecera">
        <div>
          <h1 id="titulo-clientes" ref={titulo} tabIndex={-1}>Clientes</h1>
          <p className="vista-descripcion">Personas que reservan servicios en el centro termal.</p>
        </div>
        {escribe && (
          <button type="button" className="boton boton-principal" data-accion="nuevo" onClick={() => setFormulario({ cliente: null })}>
            Nuevo cliente
          </button>
        )}
      </header>

      <div className="barra-filtros">
        <div className="campo campo-busqueda">
          <label htmlFor="buscar-clientes">Buscar por nombre o RUT</label>
          <input
            id="buscar-clientes"
            type="search"
            autoComplete="off"
            placeholder="Ej: Camila o 15.432.876"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </div>
        <FiltroSelect id="filtro-estado" etiqueta="Estado" valor={estado} onCambio={setEstado} opciones={ESTADOS_CLIENTE} />
      </div>

      <div className="tabla-contenedor">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">RUT</th>
              <th scope="col">Cuenta web</th>
              <th scope="col">Estado</th>
              <th scope="col"><span className="solo-lector">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {cargando && datos.length === 0 && <FilasCarga columnas={5} />}
            {datos.map((cliente) => (
              <tr key={cliente.id}>
                <td className="titulo">{cliente.nombre}</td>
                <td className="rut" data-etiqueta="RUT">{formatearRut(cliente.rut)}</td>
                <td className="secundario" data-etiqueta="Cuenta web">{cliente.tieneCuentaWeb ? 'Sí' : 'No'}</td>
                <td data-etiqueta="Estado"><EtiquetaEstado valor={cliente.estado} etiquetas={ESTADOS_CLIENTE} /></td>
                <Acciones
                  nombre={cliente.nombre}
                  estado={cliente.estado}
                  onVerReservas={veReservas ? () => setHistorialDe(cliente) : undefined}
                  onEditar={escribe ? () => setFormulario({ cliente }) : undefined}
                  onAlternarEstado={escribe ? () => alternarEstado(cliente) : undefined}
                  onEliminar={escribe ? () => setPorEliminar(cliente) : undefined}
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
          mensajeVacio={
            busqueda || estado ? 'Ningún cliente coincide con la búsqueda o el filtro.' : 'Aún no hay clientes registrados.'
          }
          accion={escribe && !busqueda && !estado ? { texto: 'Nuevo cliente', onClick: () => setFormulario({ cliente: null }) } : undefined}
        />
      </div>
      <VerMas hayMas={hayMas} cargando={cargandoMas} onClick={cargarMas} />

      {formulario && (
        <FormularioCliente
          cliente={formulario.cliente}
          onCerrar={() => setFormulario(null)}
          onGuardado={(mensaje) => {
            setFormulario(null);
            avisar(mensaje);
            recargar();
          }}
          onConflicto={() => {
            setFormulario(null);
            recargar();
          }}
        />
      )}

      {historialDe && <HistorialCliente cliente={historialDe} onCerrar={() => setHistorialDe(null)} />}

      {porEliminar && (
        <DialogoConfirmar
          titulo={`¿Eliminar a ${porEliminar.nombre}?`}
          mensaje="Esta acción no se puede deshacer. Si el cliente ya tiene reservas, márcalo como inactivo en vez de eliminarlo."
          textoBoton="Eliminar cliente"
          onConfirmar={eliminar}
          onCancelar={() => setPorEliminar(null)}
        />
      )}
    </section>
  );
}

// Misma regla que el servidor, para avisar antes de enviar. El servidor igual vuelve a validar.
function validar(datos) {
  const errores = {};
  if (datos.nombre.length < NOMBRE.min) errores.nombre = `Debe tener al menos ${NOMBRE.min} caracteres.`;
  else if (!nombrePersonaValido(datos.nombre)) errores.nombre = MENSAJE_NOMBRE_PERSONA;
  if (!normalizarRut(datos.rut)) errores.rut = 'RUT inválido. Revisa el número y el dígito verificador.';
  return errores;
}

// RF-01: historial de reservas y servicios previos del cliente (todas las fechas y estados).
function HistorialCliente({ cliente, onCerrar }) {
  const [reservas, setReservas] = useState(null); // null = cargando
  const [error, setError] = useState(null);

  useEffect(() => {
    const control = new AbortController();
    api('GET', `/api/reservas?clienteId=${cliente.id}&periodo=todas&limite=100`, undefined, control.signal)
      .then(({ datos }) => setReservas(datos))
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      });
    return () => control.abort();
  }, [cliente.id]);

  return (
    <Dialogo id="dialogo-historial" titulo={`Reservas de ${cliente.nombre}`} onCerrar={onCerrar}>
      {error && <p className="campo-error" role="alert">No se pudo cargar el historial. {error}</p>}
      {!error && reservas === null && <p className="campo-ayuda">Cargando…</p>}
      {reservas?.length === 0 && <p className="campo-ayuda">Este cliente todavía no tiene reservas.</p>}
      {reservas?.length > 0 && (
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Fecha y hora</th>
                <th scope="col">Servicio</th>
                <th scope="col">Recurso</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {reservas.map((reserva) => (
                <tr key={reserva.id}>
                  <td className="titulo">
                    {formatearFecha(reserva.fecha)} · {reserva.horaInicio}–{reserva.horaFin}
                  </td>
                  <td data-etiqueta="Servicio">
                    {reserva.servicio.nombre}
                    {reserva.cantidadPersonas > 1 && ` · ${reserva.cantidadPersonas} personas`}
                  </td>
                  <td data-etiqueta="Recurso">{reserva.recurso.nombre}</td>
                  <td data-etiqueta="Estado">
                    <EtiquetaEstado valor={reserva.estado} etiquetas={ESTADOS_RESERVA} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="dialogo-acciones">
        <button type="button" className="boton boton-secundario" onClick={onCerrar}>Cerrar</button>
      </div>
    </Dialogo>
  );
}

function FormularioCliente({ cliente, onCerrar, onGuardado, onConflicto }) {
  const avisar = useAvisos();
  const formularioRef = useRef(null);
  const esEdicion = cliente !== null;
  const [nombre, setNombre] = useState(cliente?.nombre ?? '');
  const [rut, setRut] = useState(cliente ? formatearRut(cliente.rut) : '');
  const [estado, setEstado] = useState(cliente?.estado ?? 'activo');
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    enfocarPrimerError(formularioRef.current);
  }, [errores]);

  async function guardar(evento) {
    evento.preventDefault();
    const datos = { nombre: nombre.trim(), rut };
    // Al editar se envía también la versión que se vio al abrir el formulario: si otra persona
    // lo modificó mientras tanto, el servidor lo rechaza en vez de pisar su cambio.
    if (esEdicion) Object.assign(datos, { estado, version: cliente.version });

    const erroresLocales = validar(datos);
    setErrores(erroresLocales);
    if (Object.keys(erroresLocales).length > 0) return;

    setGuardando(true);
    try {
      if (esEdicion) await api('PUT', `/api/clientes/${cliente.id}`, datos);
      else await api('POST', '/api/clientes', datos);
      onGuardado(esEdicion ? 'Cliente actualizado.' : 'Cliente creado.');
    } catch (err) {
      setGuardando(false);
      if (err.codigo === 'CONFLICTO_VERSION') {
        avisar(err.message, 'error');
        onConflicto();
      } else if (err instanceof ErrorApi && err.detalles) setErrores(err.detalles);
      else avisar(err.message, 'error');
    }
  }

  // Al salir del campo, si el RUT es válido se muestra con puntos.
  function formatearAlSalir() {
    const normalizado = normalizarRut(rut);
    if (normalizado) setRut(formatearRut(normalizado));
  }

  return (
    <Dialogo id="dialogo-cliente" titulo={esEdicion ? 'Editar cliente' : 'Nuevo cliente'} onCerrar={onCerrar}>
      <form ref={formularioRef} noValidate onSubmit={guardar}>
        <CampoTexto
          id="cliente-nombre" nombre="nombre" etiqueta="Nombre completo"
          valor={nombre} onCambio={setNombre} error={errores.nombre} maxLength={NOMBRE.max}
        />
        <CampoTexto
          id="cliente-rut" nombre="rut" etiqueta="RUT" placeholder="12.345.678-5"
          valor={rut} onCambio={setRut} onBlur={formatearAlSalir} error={errores.rut}
          ayuda="Con o sin puntos. Se revisa el dígito verificador."
        />
        {/* Al crear, el cliente queda "activo"; el estado solo se cambia al editar. */}
        {esEdicion && (
          <CampoSelect
            id="cliente-estado" nombre="estado" etiqueta="Estado"
            valor={estado} onCambio={setEstado} opciones={ESTADOS_CLIENTE} error={errores.estado}
          />
        )}
        <div className="dialogo-acciones">
          <button type="button" className="boton boton-secundario" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="boton boton-principal" disabled={guardando}>Guardar cliente</button>
        </div>
      </form>
    </Dialogo>
  );
}
