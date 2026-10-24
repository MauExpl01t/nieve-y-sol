// Pantalla de Reservas:
// consultar con filtros (RF-18), crear (RF-15/16), reprogramar (RF-19), registrar pago (RF-25),
// cancelar (RF-20) y eliminar. Al crear o reprogramar se valida la disponibilidad (RF-22),
// se pueden ver los horarios con cupo (RF-23) y, si no hay cupo, se sugieren alternativas (RF-24).
import { useEffect, useRef, useState } from 'react';
import { api, ErrorApi } from '../api.js';
import { useAvisos } from '../componentes/Avisos.jsx';
import { useListado, useValorRetrasado } from '../hooks/useListado.js';
import { useDatos } from '../hooks/useDatos.js';
import { Dialogo, DialogoConfirmar } from '../componentes/Dialogo.jsx';
import { CampoTexto, CampoSelect, enfocarPrimerError } from '../componentes/Campos.jsx';
import { CampoCliente } from '../componentes/CampoCliente.jsx';
import { useSesion } from '../componentes/Sesion.jsx';
import { EtiquetaEstado, MensajeLista, VerMas, FilasCarga } from '../componentes/Tabla.jsx';
import { MenuAcciones } from '../componentes/Menu.jsx';
import { Agenda } from '../componentes/Agenda.jsx';
import { IconoLista, IconoAgenda, IconoReloj, IconoPersonas } from '../componentes/Iconos.jsx';
import { formatearFecha, formatearFechaLarga, formatearPrecio, etiquetaFecha, hoy } from '../formato.js';
import { formatearRut } from '../../../compartido/rut.js';
import { ESTADOS_RESERVA, ESTADOS_ACTIVOS, HORARIO, PLAZO_PAGO_MIN, permite } from '../../../compartido/catalogos.js';
import { aMinutos, aHora, esHoraDeBloque, dentroDeHorario } from '../../../compartido/horario.js';

const PERIODOS = { proximas: 'Próximas', todas: 'Todas (incluye pasadas)' };

// " (4 personas)" para una reserva de grupo; vacío si es de una sola persona.
function deGrupo(reserva) {
  return reserva.cantidadPersonas > 1 ? ` (${reserva.cantidadPersonas} personas)` : '';
}

// Textos de los diálogos de confirmación para cada acción.
const CONFIRMACIONES = {
  pago: {
    titulo: (r) => `¿Registrar el pago de ${formatearPrecio(r.servicio.precio)}?`,
    mensaje: (r) => `${r.cliente.nombre}${deGrupo(r)} · ${r.servicio.nombre} · ${formatearFecha(r.fecha)} a las ${r.horaInicio}. La reserva quedará confirmada.`,
    boton: 'Registrar pago',
    variante: 'principal',
    // La versión que se vio: si otra persona ya cambió la reserva, el servidor lo rechaza.
    peticion: (r) => ['POST', `/api/reservas/${r.id}/pago`, { version: r.version }],
    exito: 'Pago registrado. La reserva quedó confirmada.',
  },
  cancelar: {
    titulo: (r) => `¿Cancelar la reserva de ${r.cliente.nombre}?`,
    mensaje: (r) => `${r.servicio.nombre} · ${formatearFecha(r.fecha)} a las ${r.horaInicio}. El cupo quedará libre y la reserva queda en el historial como cancelada.`,
    boton: 'Cancelar reserva',
    variante: 'peligro',
    peticion: (r) => ['POST', `/api/reservas/${r.id}/cancelar`, { version: r.version }],
    exito: 'Reserva cancelada.',
  },
  eliminar: {
    titulo: () => '¿Eliminar esta reserva?',
    mensaje: (r) => `${r.cliente.nombre} · ${r.servicio.nombre} · ${formatearFecha(r.fecha)} a las ${r.horaInicio}. Se borra para siempre. Si solo quieres liberar el horario, usa Cancelar: así queda en el historial.`,
    boton: 'Eliminar reserva',
    variante: 'peligro',
    peticion: (r) => ['DELETE', `/api/reservas/${r.id}`],
    exito: 'Reserva eliminada.',
  },
};

export default function Reservas({ moverFoco }) {
  const avisar = useAvisos();
  const escribe = useSesion().puede('reservas', 'escribir'); // crear, reprogramar, pagar, cancelar y eliminar
  const titulo = useRef(null);
  const recursos = useDatos('/api/recursos?limite=100');

  const [buscar, setBuscar] = useState('');
  const [fecha, setFecha] = useState('');
  const [periodo, setPeriodo] = useState('proximas');
  const [recursoId, setRecursoId] = useState('');
  const [estado, setEstado] = useState('');
  const busqueda = useValorRetrasado(buscar.trim());
  const { datos, hayMas, cargando, cargandoMas, error, recargar: recargarLista, cargarMas } = useListado('/api/reservas', {
    buscar: busqueda,
    fecha,
    periodo: fecha ? '' : periodo,
    recursoId,
    estado,
  });
  const hayFiltros = Boolean(busqueda || fecha || recursoId || estado || periodo === 'todas');

  // formulario: null = cerrado | { reserva: null, inicial? } = nueva | { reserva } = reprogramar
  const [formulario, setFormulario] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null); // { tipo, reserva }
  const [detalle, setDetalle] = useState(null); // reserva abierta desde la agenda
  const [vista, setVista] = useState('lista'); // 'lista' | 'agenda'
  const [fechaAgenda, setFechaAgenda] = useState(hoy);

  // Después de pagar, cancelar, crear, etc.: se recarga la lista, el resumen y la agenda.
  const [versionDatos, setVersionDatos] = useState(0);
  function recargar() {
    recargarLista();
    setVersionDatos((v) => v + 1);
  }

  // Acción elegida sobre una reserva (desde la fila o desde el detalle de la agenda).
  function accionSobre(tipo, reserva) {
    setDetalle(null);
    if (tipo === 'reprogramar') setFormulario({ reserva });
    else setConfirmacion({ tipo, reserva });
  }

  useEffect(() => {
    if (moverFoco) titulo.current.focus();
  }, [moverFoco]);

  async function ejecutarConfirmacion() {
    const { tipo, reserva } = confirmacion;
    setConfirmacion(null);
    const accion = CONFIRMACIONES[tipo];
    try {
      await api(...accion.peticion(reserva));
      avisar(accion.exito);
      recargar();
    } catch (err) {
      avisar(err.message, 'error');
      recargar(); // el estado pudo cambiar mientras tanto
    }
  }

  const opcionesRecursos = Object.fromEntries((recursos ?? []).map((r) => [r.id, r.nombre]));

  return (
    <section id="vista-reservas" className="vista" aria-labelledby="titulo-reservas" aria-busy={cargando || undefined}>
      <header className="vista-cabecera">
        <div>
          <h1 id="titulo-reservas" ref={titulo} tabIndex={-1}>Reservas</h1>
          <p className="vista-descripcion">
            Horas reservadas en el centro termal. Una reserva nueva queda pendiente hasta registrar su pago; si pasan {PLAZO_PAGO_MIN} minutos sin pago, se libera sola.
          </p>
        </div>
        <div className="vista-acciones">
          <div className="selector-vista" role="group" aria-label="Forma de ver las reservas">
            <button type="button" aria-pressed={vista === 'lista'} onClick={() => setVista('lista')}>
              <IconoLista /> Lista
            </button>
            <button type="button" aria-pressed={vista === 'agenda'} data-vista="agenda" onClick={() => setVista('agenda')}>
              <IconoAgenda /> Agenda
            </button>
          </div>
          {escribe && (
            <button type="button" className="boton boton-principal" data-accion="nuevo" onClick={() => setFormulario({ reserva: null })}>
              Nueva reserva
            </button>
          )}
        </div>
      </header>

      {vista === 'lista' && <ResumenDia version={versionDatos} />}

      {vista === 'agenda' ? (
        <Agenda
          fecha={fechaAgenda}
          onCambiarFecha={setFechaAgenda}
          recursos={recursos}
          version={versionDatos}
          puedeCrear={escribe}
          onNueva={(inicial) => setFormulario({ reserva: null, inicial })}
          onAbrir={setDetalle}
        />
      ) : (
      <>
      <div className="barra-filtros">
        <div className="campo campo-busqueda">
          <label htmlFor="buscar-reservas">Buscar por cliente (nombre o RUT)</label>
          <input
            id="buscar-reservas"
            type="search"
            autoComplete="off"
            placeholder="Ej: Camila o 15.432.876"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="filtro-fecha">Fecha</label>
          <input id="filtro-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <FiltroSelect
          id="filtro-periodo" etiqueta="Período" valor={periodo} onCambio={setPeriodo}
          opciones={PERIODOS} disabled={Boolean(fecha)} sinTodos
        />
        <FiltroSelect id="filtro-recurso" etiqueta="Recurso" valor={recursoId} onCambio={setRecursoId} opciones={opcionesRecursos} />
        <FiltroSelect id="filtro-estado-reserva" etiqueta="Estado" valor={estado} onCambio={setEstado} opciones={ESTADOS_RESERVA} />
      </div>
      {fecha && (
        <p className="nota-filtro">
          Mostrando el {formatearFecha(fecha)}.{' '}
          <button type="button" className="boton-texto" onClick={() => setFecha('')}>Quitar fecha</button>
        </p>
      )}

      <div className="tabla-contenedor">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Fecha y hora</th>
              <th scope="col">Cliente</th>
              <th scope="col">Servicio y recurso</th>
              <th scope="col" className="numero">Personas</th>
              <th scope="col">Estado</th>
              <th scope="col"><span className="solo-lector">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {cargando && datos.length === 0 && <FilasCarga columnas={6} />}
            {datos.map((reserva) => (
              <FilaReserva
                key={reserva.id}
                reserva={reserva}
                puedeModificar={escribe}
                onAccion={(tipo) => accionSobre(tipo, reserva)}
                onVencida={recargar}
              />
            ))}
          </tbody>
        </table>
        <MensajeLista
          cargando={cargando}
          error={error}
          cantidad={datos.length}
          onReintentar={recargar}
          mensajeVacio={hayFiltros ? 'Ninguna reserva coincide con la búsqueda o los filtros.' : 'No hay reservas próximas.'}
          accion={escribe && !hayFiltros ? { texto: 'Nueva reserva', onClick: () => setFormulario({ reserva: null }) } : undefined}
        />
      </div>
      <VerMas hayMas={hayMas} cargando={cargandoMas} onClick={cargarMas} />
      </>
      )}

      {formulario && (
        <FormularioReserva
          reserva={formulario.reserva}
          inicial={formulario.inicial}
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

      {detalle && (
        <DetalleReserva
          reserva={detalle}
          puedeModificar={escribe}
          onAccion={(tipo) => accionSobre(tipo, detalle)}
          onCerrar={() => setDetalle(null)}
          onVencida={recargar}
        />
      )}

      {confirmacion && (
        <DialogoConfirmar
          titulo={CONFIRMACIONES[confirmacion.tipo].titulo(confirmacion.reserva)}
          mensaje={CONFIRMACIONES[confirmacion.tipo].mensaje(confirmacion.reserva)}
          textoBoton={CONFIRMACIONES[confirmacion.tipo].boton}
          variante={CONFIRMACIONES[confirmacion.tipo].variante}
          onConfirmar={ejecutarConfirmacion}
          onCancelar={() => setConfirmacion(null)}
        />
      )}
    </section>
  );
}

// Qué acciones existen y cómo se llaman: [acción del estado, tipo de confirmación, texto, peligrosa]
const ACCIONES = [
  ['registrarPago', 'pago', 'Registrar pago', false],
  ['reprogramar', 'reprogramar', 'Reprogramar', false],
  ['cancelar', 'cancelar', 'Cancelar', true],
  ['eliminar', 'eliminar', 'Eliminar', true],
];

function accionesDe(reserva, puedeModificar) {
  return ACCIONES.filter(([accion]) => puedeModificar && permite(reserva.estado, accion));
}

// "Vence en 12 min": cuenta regresiva del plazo de pago de una reserva pendiente.
// Cuando llega a cero avisa (onVencida) para que la lista pida al servidor liberar el cupo.
function CuentaRegresiva({ creadoEn, onVencida }) {
  const limite = new Date(creadoEn).getTime() + PLAZO_PAGO_MIN * 60_000;
  const [ahora, setAhora] = useState(() => Date.now());
  const avisada = useRef(false);

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(Date.now()), 15_000);
    return () => clearInterval(intervalo);
  }, []);

  const faltan = limite - ahora;
  useEffect(() => {
    if (faltan <= 0 && !avisada.current) {
      avisada.current = true;
      onVencida?.();
    }
  }, [faltan, onVencida]);

  const minutos = Math.ceil(faltan / 60_000);
  const texto = faltan <= 0 ? 'Plazo vencido' : `Vence en ${minutos} min`;
  const urgente = faltan <= 5 * 60_000;
  return (
    <span className={`cuenta-regresiva${urgente ? ' urgente' : ''}`}>
      <IconoReloj tam="0.875rem" /> {texto}
    </span>
  );
}

// Tarjetas de resumen sobre la lista: lo que importa hoy de un vistazo.
// Es un apoyo: si no se puede cargar, simplemente no se muestra.
function ResumenDia({ version }) {
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    const control = new AbortController();
    Promise.all([
      api('GET', `/api/reservas?fecha=${hoy()}&limite=100`, undefined, control.signal),
      api('GET', '/api/reservas?estado=pendiente_pago&limite=100', undefined, control.signal),
    ])
      .then(([dia, pendientes]) => setDatos({ dia: dia.datos, pendientes: pendientes.datos }))
      .catch(() => {});
    return () => control.abort();
  }, [version]);

  if (!datos) return null;
  const ahora = Date.now();
  const deHoy = datos.dia.filter((r) => ESTADOS_ACTIVOS.includes(r.estado));
  const personas = deHoy.reduce((suma, r) => suma + r.cantidadPersonas, 0);
  const proxima = deHoy.find((r) => new Date(r.inicio).getTime() > ahora);
  const vencimientos = datos.pendientes
    .map((r) => new Date(r.creadoEn).getTime() + PLAZO_PAGO_MIN * 60_000 - ahora)
    .filter((ms) => ms > 0);
  const masCercano = vencimientos.length > 0 ? Math.ceil(Math.min(...vencimientos) / 60_000) : null;

  return (
    <ul className="resumen" aria-label="Resumen de hoy">
      <li className="resumen-tarjeta">
        <span className="resumen-icono"><IconoPersonas /></span>
        <span className="resumen-texto">
          <span className="resumen-titulo">Reservas de hoy</span>
          <strong className="resumen-valor">{deHoy.length}</strong>
          <span className="resumen-detalle">
            {deHoy.length === 0 ? 'Sin reservas hoy' : `${personas} ${personas === 1 ? 'persona' : 'personas'} en total`}
          </span>
        </span>
      </li>
      <li className={`resumen-tarjeta${datos.pendientes.length > 0 ? ' atencion' : ''}`}>
        <span className="resumen-icono"><IconoReloj /></span>
        <span className="resumen-texto">
          <span className="resumen-titulo">Pendientes de pago</span>
          <strong className="resumen-valor">{datos.pendientes.length}</strong>
          <span className="resumen-detalle">
            {masCercano === null ? 'Ninguna por vencer' : `La próxima vence en ${masCercano} min`}
          </span>
        </span>
      </li>
      <li className="resumen-tarjeta">
        <span className="resumen-icono"><IconoAgenda /></span>
        <span className="resumen-texto">
          <span className="resumen-titulo">Próxima de hoy</span>
          <strong className="resumen-valor">{proxima ? proxima.horaInicio : '—'}</strong>
          <span className="resumen-detalle">
            {proxima ? `${proxima.cliente.nombre} · ${proxima.servicio.nombre}` : 'No quedan reservas hoy'}
          </span>
        </span>
      </li>
    </ul>
  );
}

// Ficha de una reserva (se abre desde la agenda) con las acciones que permite su estado.
function DetalleReserva({ reserva, puedeModificar, onAccion, onCerrar, onVencida }) {
  const acciones = accionesDe(reserva, puedeModificar);
  const peligrosas = acciones.filter(([, , , peligro]) => peligro);
  const habituales = acciones.filter(([, , , peligro]) => !peligro);
  return (
    <Dialogo id="dialogo-detalle" titulo="Detalle de la reserva" onCerrar={onCerrar}>
      <dl className="detalle">
        <div><dt>Cliente</dt><dd>{reserva.cliente.nombre} · {formatearRut(reserva.cliente.rut)}</dd></div>
        <div><dt>Servicio</dt><dd>{reserva.servicio.nombre} · {formatearPrecio(reserva.servicio.precio)}</dd></div>
        <div>
          <dt>Fecha y hora</dt>
          <dd>{formatearFechaLarga(reserva.fecha)}, {reserva.horaInicio}–{reserva.horaFin}</dd>
        </div>
        <div><dt>Recurso</dt><dd>{reserva.recurso.nombre}</dd></div>
        <div><dt>Personas</dt><dd>{reserva.cantidadPersonas}</dd></div>
        <div>
          <dt>Estado</dt>
          <dd className="detalle-estado">
            <EtiquetaEstado valor={reserva.estado} etiquetas={ESTADOS_RESERVA} />
            {reserva.estado === 'pendiente_pago' && <CuentaRegresiva creadoEn={reserva.creadoEn} onVencida={onVencida} />}
          </dd>
        </div>
      </dl>
      <div className="dialogo-acciones dialogo-acciones-detalle">
        {peligrosas.map(([accion, tipo, texto]) => (
          <button key={accion} type="button" className="boton boton-peligro-suave" data-accion={accion} onClick={() => onAccion(tipo)}>
            {texto}
          </button>
        ))}
        <span className="espaciador" />
        <button type="button" className="boton boton-secundario" onClick={onCerrar}>Cerrar</button>
        {habituales.map(([accion, tipo, texto], i) => (
          <button
            key={accion}
            type="button"
            className={`boton ${i === 0 ? 'boton-principal' : 'boton-secundario'}`}
            data-accion={accion}
            onClick={() => onAccion(tipo)}
          >
            {texto}
          </button>
        ))}
      </div>
    </Dialogo>
  );
}

// puedeModificar: según el rol. Quien solo consulta (Supervisor) ve la reserva sin botones de acción.
// La acción principal (según el estado) queda a la vista; las demás van en el menú "⋯".
function FilaReserva({ reserva, onAccion, onVencida, puedeModificar }) {
  const descripcion = `${reserva.cliente.nombre}, ${formatearFecha(reserva.fecha)} ${reserva.horaInicio}`;
  const [principal, ...resto] = accionesDe(reserva, puedeModificar);
  const itemsMenu = resto.map(([accion, tipo, texto, peligro], i) => ({
    texto,
    accion,
    peligro,
    separador: peligro && !resto[i - 1]?.[3],
    onClick: () => onAccion(tipo),
  }));
  const diaCorto = etiquetaFecha(reserva.fecha);
  const esRelativa = diaCorto === 'Hoy' || diaCorto === 'Mañana';

  return (
    <tr className={`fila-${reserva.estado}`}>
      <td className="titulo">
        <span className="dato-pila">
          <span className="dato-principal">{diaCorto}</span>
          <span className="dato-secundario">
            {reserva.horaInicio}–{reserva.horaFin}{esRelativa ? ` · ${formatearFecha(reserva.fecha)}` : ''}
          </span>
        </span>
      </td>
      <td data-etiqueta="Cliente">
        <span className="dato-pila">
          <span className="dato-principal">{reserva.cliente.nombre}</span>
          <span className="dato-secundario rut">{formatearRut(reserva.cliente.rut)}</span>
        </span>
      </td>
      <td data-etiqueta="Servicio">
        <span className="dato-pila">
          <span className="dato-principal">{reserva.servicio.nombre}</span>
          <span className="dato-secundario">{reserva.recurso.nombre}</span>
        </span>
      </td>
      <td className="numero" data-etiqueta="Personas">{reserva.cantidadPersonas}</td>
      <td data-etiqueta="Estado">
        <span className="dato-pila estado-pila">
          <EtiquetaEstado valor={reserva.estado} etiquetas={ESTADOS_RESERVA} />
          {reserva.estado === 'pendiente_pago' && <CuentaRegresiva creadoEn={reserva.creadoEn} onVencida={onVencida} />}
        </span>
      </td>
      <td className="acciones">
        <div className="acciones-lista">
          {principal && (
            <button
              type="button"
              className={`boton boton-chico ${principal[0] === 'registrarPago' ? 'boton-principal' : 'boton-secundario'}`}
              data-accion={principal[0]}
              aria-label={`${principal[2]}: ${descripcion}`}
              onClick={() => onAccion(principal[1])}
            >
              {principal[2]}
            </button>
          )}
          {itemsMenu.length > 0 && <MenuAcciones items={itemsMenu} contexto={descripcion} />}
        </div>
      </td>
    </tr>
  );
}

function FiltroSelect({ id, etiqueta, valor, onCambio, opciones, disabled, sinTodos }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <select id={id} value={valor} onChange={(e) => onCambio(e.target.value)} disabled={disabled}>
        {!sinTodos && <option value="">Todos</option>}
        {Object.entries(opciones).map(([clave, texto]) => (
          <option key={clave} value={clave}>{texto}</option>
        ))}
      </select>
    </div>
  );
}

// Misma regla que el servidor, para avisar antes de enviar. El servidor igual vuelve a validar.
function validar(datos, servicio, esEdicion, recurso) {
  const errores = {};
  const personas = datos.cantidadPersonas;
  if (!Number.isInteger(personas) || personas < 1) {
    errores.cantidadPersonas = 'Indica cuántas personas son (1 o más).';
  } else if (recurso && personas > recurso.capacidadMaxima) {
    errores.cantidadPersonas = `${recurso.nombre} admite hasta ${recurso.capacidadMaxima} personas a la vez.`;
  }
  if (!esEdicion && !datos.clienteId) errores.clienteId = 'Elige un cliente.';
  if (!datos.servicioId) errores.servicioId = 'Elige un servicio.';
  if (!datos.recursoId) errores.recursoId = 'Elige un recurso.';
  if (!datos.fecha) errores.fecha = 'Elige una fecha.';
  if (!esHoraDeBloque(datos.hora)) {
    errores.hora = 'Elige una hora en bloques de 15 minutos (ej. 10:00, 10:15).';
  } else if (servicio && !dentroDeHorario(aMinutos(datos.hora), aMinutos(datos.hora) + servicio.duracionMin)) {
    errores.hora = `El centro atiende de ${HORARIO.apertura} a ${HORARIO.cierre}; este servicio debe empezar a más tardar a las ${aHora(aMinutos(HORARIO.cierre) - servicio.duracionMin)}.`;
  }
  return errores;
}

// inicial: valores de partida al crear desde la agenda ({ recursoId, fecha, hora }).
function FormularioReserva({ reserva, inicial, onCerrar, onGuardado, onConflicto }) {
  const avisar = useAvisos();
  const formularioRef = useRef(null);
  const esEdicion = reserva !== null;

  const servicios = useDatos('/api/servicios');
  const recursos = useDatos('/api/recursos?estado=activo&limite=100');

  const [clienteId, setClienteId] = useState(reserva?.cliente.id ?? '');
  const [servicioId, setServicioId] = useState(reserva?.servicio.id ?? '');
  const [recursoId, setRecursoId] = useState(reserva?.recurso.id ?? inicial?.recursoId ?? '');
  const [fecha, setFecha] = useState(reserva?.fecha ?? inicial?.fecha ?? '');
  const [hora, setHora] = useState(reserva?.horaInicio ?? inicial?.hora ?? '');
  const [personas, setPersonas] = useState(String(reserva?.cantidadPersonas ?? 1)); // tamaño del grupo
  const [errores, setErrores] = useState({});
  const [conflicto, setConflicto] = useState(null); // { mensaje, sugerencias }
  const [disponibles, setDisponibles] = useState(null); // horarios con cupo (RF-23)
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    enfocarPrimerError(formularioRef.current);
  }, [errores]);

  const servicio = servicios?.find((s) => s.id === servicioId) ?? null;
  const recursosCompatibles = (recursos ?? []).filter((r) => !servicio || servicio.recursoIds.includes(r.id));

  // Si cambian servicio, recurso o fecha, los horarios consultados y las sugerencias ya no sirven.
  useEffect(() => {
    setDisponibles(null);
    setConflicto(null);
  }, [servicioId, recursoId, fecha, personas]);

  function elegirServicio(id) {
    setServicioId(id);
    const elegido = servicios?.find((s) => s.id === id);
    if (!elegido) return;
    const compatibles = (recursos ?? []).filter((r) => elegido.recursoIds.includes(r.id));
    // Si el recurso elegido no ofrece este servicio, se limpia; si hay uno solo posible, se elige solo.
    if (!compatibles.some((r) => r.id === recursoId)) {
      setRecursoId(compatibles.length === 1 ? compatibles[0].id : '');
    }
  }

  async function verHorarios() {
    const parametros = new URLSearchParams({ servicioId, recursoId, fecha });
    if (Number.isInteger(Number(personas)) && Number(personas) > 1) parametros.set('personas', personas);
    if (esEdicion) parametros.set('excluirId', reserva.id);
    try {
      const respuesta = await api('GET', `/api/disponibilidad?${parametros}`);
      setDisponibles(respuesta.horarios);
    } catch (err) {
      avisar(err.message, 'error');
    }
  }

  function elegirHora(valor) {
    setHora(valor);
    setConflicto(null);
    // Se quita solo el error de la hora; si no había, se deja el mismo objeto para no mover el foco.
    setErrores((anteriores) => {
      if (!anteriores.hora) return anteriores;
      const { hora: _, ...resto } = anteriores;
      return resto;
    });
  }

  async function guardar(evento) {
    evento.preventDefault();
    setConflicto(null);
    const datos = {
      servicioId, recursoId, fecha, hora,
      cantidadPersonas: personas.trim() === '' ? null : Number(personas),
    };
    if (!esEdicion) datos.clienteId = clienteId;
    else datos.version = reserva.version; // la que se vio al abrir: detecta cambios de otra persona

    const recursoElegido = (recursos ?? []).find((r) => r.id === recursoId);
    const erroresLocales = validar(datos, servicio, esEdicion, recursoElegido);
    setErrores(erroresLocales);
    if (Object.keys(erroresLocales).length > 0) return;

    setGuardando(true);
    try {
      if (esEdicion) await api('PUT', `/api/reservas/${reserva.id}`, datos);
      else await api('POST', '/api/reservas', datos);
      onGuardado(esEdicion
        ? 'Reserva reprogramada.'
        : `Reserva creada. Queda pendiente: se libera sola si no se paga en ${PLAZO_PAGO_MIN} minutos.`);
    } catch (err) {
      setGuardando(false);
      if (!(err instanceof ErrorApi)) {
        avisar(err.message, 'error');
      } else if (err.detalles) {
        setErrores(err.detalles);
        // Al reprogramar, el cliente no es un campo del formulario: su error se muestra como aviso.
        if (esEdicion && err.detalles.clienteId) {
          avisar(`${err.detalles.clienteId} Actívalo en Clientes para poder reprogramar su reserva.`, 'error');
        }
      } else if (err.codigo === 'CONFLICTO_VERSION') {
        // Otra persona modificó la reserva: se cierra el formulario y la lista se recarga con lo nuevo.
        avisar(err.message, 'error');
        onConflicto();
      } else if (err.estado === 409) {
        setConflicto({ mensaje: err.message, sugerencias: err.sugerencias ?? [] });
      } else {
        avisar(err.message, 'error');
      }
    }
  }

  const opcionesServicios = Object.fromEntries(
    (servicios ?? []).map((s) => [s.id, `${s.nombre} (${s.duracionMin} min)`]),
  );
  const opcionesRecursos = Object.fromEntries(recursosCompatibles.map((r) => [r.id, `${r.nombre} · capacidad ${r.capacidadMaxima}`]));
  const horaFin = servicio && esHoraDeBloque(hora) ? aHora(aMinutos(hora) + servicio.duracionMin) : null;
  const cargandoDatos = !servicios || !recursos;

  return (
    <Dialogo id="dialogo-reserva" titulo={esEdicion ? 'Reprogramar reserva' : 'Nueva reserva'} onCerrar={onCerrar}>
      <form ref={formularioRef} noValidate onSubmit={guardar}>
        {esEdicion ? (
          <div className="campo">
            <span className="etiqueta-fija">Cliente</span>
            <p className="valor-fijo">{reserva.cliente.nombre} · {formatearRut(reserva.cliente.rut)}</p>
          </div>
        ) : (
          <CampoCliente id="reserva-cliente" onCambio={setClienteId} error={errores.clienteId} />
        )}
        <CampoSelect
          id="reserva-servicio" nombre="servicioId" etiqueta="Servicio" opcionVacia={servicios ? 'Elige un servicio' : 'Cargando…'}
          valor={servicioId} onCambio={elegirServicio} opciones={opcionesServicios} error={errores.servicioId}
          ayuda={servicio ? `Dura ${servicio.duracionMin} minutos · ${formatearPrecio(servicio.precio)}` : undefined}
        />
        <CampoSelect
          id="reserva-recurso" nombre="recursoId" etiqueta="Recurso" opcionVacia={recursos ? 'Elige un recurso' : 'Cargando…'}
          valor={recursoId} onCambio={setRecursoId} opciones={opcionesRecursos} error={errores.recursoId}
          ayuda={servicio ? 'Solo aparecen los recursos activos que ofrecen este servicio.' : undefined}
        />
        <CampoTexto
          id="reserva-personas" nombre="cantidadPersonas" etiqueta="Cantidad de personas"
          type="number" inputMode="numeric" min={1} step={1}
          valor={personas} onCambio={setPersonas} error={errores.cantidadPersonas}
          ayuda="Un grupo ocupa tantos cupos del recurso como personas lleva."
        />
        <div className="fila-campos">
          <CampoTexto
            id="reserva-fecha" nombre="fecha" etiqueta="Fecha" type="date" min={hoy()}
            valor={fecha} onCambio={setFecha} error={errores.fecha}
          />
          <CampoTexto
            id="reserva-hora" nombre="hora" etiqueta="Hora de inicio" type="time" step={900}
            min={HORARIO.apertura} max={HORARIO.cierre}
            valor={hora} onCambio={elegirHora} error={errores.hora}
            ayuda={horaFin ? `Termina a las ${horaFin}` : `Atención de ${HORARIO.apertura} a ${HORARIO.cierre}`}
          />
        </div>

        {servicioId && recursoId && fecha && (
          <div className="disponibilidad">
            {disponibles === null ? (
              <button type="button" className="boton-texto" onClick={verHorarios}>Ver horarios con cupo ese día</button>
            ) : disponibles.length === 0 ? (
              <p className="campo-ayuda">No hay horarios con cupo ese día para este servicio y recurso.</p>
            ) : (
              <>
                <p className="campo-ayuda" id="horarios-titulo">Horarios con cupo (elige uno):</p>
                <div className="horarios" role="group" aria-labelledby="horarios-titulo">
                  {disponibles.map((h) => (
                    <button
                      key={h} type="button" className={h === hora ? 'chip-hora elegido' : 'chip-hora'}
                      aria-pressed={h === hora} onClick={() => elegirHora(h)}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {servicio && recursoId && fecha && horaFin && (
          <div className="resumen-reserva" aria-live="polite">
            <span className="resumen-reserva-titulo">Resumen</span>
            <p>
              <strong>{servicio.nombre}</strong> en {(recursos ?? []).find((r) => r.id === recursoId)?.nombre}
              {' · '}{Number(personas) > 1 ? `${Number(personas)} personas` : '1 persona'}
            </p>
            <p>{formatearFechaLarga(fecha)}, de {hora} a {horaFin} · {formatearPrecio(servicio.precio)}</p>
          </div>
        )}

        {conflicto && (
          <div className="alerta-formulario" role="alert">
            <p>{conflicto.mensaje}</p>
            {conflicto.sugerencias.length > 0 && (
              <div className="horarios">
                {conflicto.sugerencias.map((h) => (
                  <button key={h} type="button" className="chip-hora" onClick={() => elegirHora(h)}>
                    Usar {h}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="dialogo-acciones">
          <button type="button" className="boton boton-secundario" onClick={onCerrar}>Volver</button>
          <button type="submit" className="boton boton-principal" disabled={guardando || cargandoDatos}>
            {esEdicion ? 'Guardar cambios' : 'Crear reserva'}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
