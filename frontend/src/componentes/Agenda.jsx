// Agenda de un día: una columna por recurso y las horas hacia abajo. Cada reserva es un bloque de color
// según su estado; un clic en un bloque abre su detalle y un clic en un espacio libre abre
// "Nueva reserva" con el recurso, la fecha y la hora ya elegidos.
//
// Si dos reservas coinciden en el tiempo dentro del mismo recurso (grupos que comparten la sala),
// se dibujan una al lado de la otra.
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { IconoFlechaIzquierda, IconoFlechaDerecha } from './Iconos.jsx';
import { formatearFechaLarga, hoy, sumarDias } from '../formato.js';
import { ESTADOS_RESERVA, TIPOS_RECURSO } from '../../../compartido/catalogos.js';
import { aMinutos, aHora, APERTURA_MIN, CIERRE_MIN } from '../../../compartido/horario.js';

const PX_POR_MIN = 1.15;
const ALTO = (CIERRE_MIN - APERTURA_MIN) * PX_POR_MIN;
const BLOQUE_MIN = 15;
// Las reservas liberadas o canceladas ya no ocupan el recurso: no se dibujan.
const SE_DIBUJAN = new Set(['pendiente_pago', 'confirmada', 'completada', 'no_show']);

// Asigna a cada reserva de una columna su "carril" y cuántos carriles tiene su grupo de reservas
// que se pisan, para repartir el ancho.
function repartirCarriles(reservas) {
  const ordenadas = [...reservas].sort((a, b) => aMinutos(a.horaInicio) - aMinutos(b.horaInicio));
  const resultado = [];
  let grupo = [];
  let finGrupo = -1;

  function cerrarGrupo() {
    const carriles = Math.max(1, ...grupo.map((g) => g.carril + 1));
    for (const item of grupo) resultado.push({ ...item, carriles });
    grupo = [];
  }

  for (const reserva of ordenadas) {
    const inicio = aMinutos(reserva.horaInicio);
    const fin = aMinutos(reserva.horaFin);
    if (grupo.length > 0 && inicio >= finGrupo) {
      cerrarGrupo();
      finGrupo = -1;
    }
    const ocupados = new Set(grupo.filter((g) => aMinutos(g.reserva.horaFin) > inicio).map((g) => g.carril));
    let carril = 0;
    while (ocupados.has(carril)) carril += 1;
    grupo.push({ reserva, carril });
    finGrupo = Math.max(finGrupo, fin);
  }
  if (grupo.length > 0) cerrarGrupo();
  return resultado;
}

function mayuscula(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// props:
//   fecha, onCambiarFecha(fecha)
//   recursos: lista de recursos (de /api/recursos)
//   version: número que cambia cuando hay que volver a cargar (después de pagar, cancelar, etc.)
//   puedeCrear: si la persona puede hacer reservas (muestra el aviso de clic en espacio libre)
//   onNueva({ recursoId, fecha, hora }), onAbrir(reserva)
export function Agenda({ fecha, onCambiarFecha, recursos, version, puedeCrear, onNueva, onAbrir }) {
  const [reservas, setReservas] = useState([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ahora, setAhora] = useState(() => new Date());
  const [intento, setIntento] = useState(0); // para el botón "Reintentar"
  const marco = useRef(null);

  useEffect(() => {
    const control = new AbortController();
    setCargando(true);
    setError('');
    api('GET', `/api/reservas?fecha=${fecha}&limite=100`, undefined, control.signal)
      .then((respuesta) => {
        setReservas(respuesta.datos);
        setHayMas(respuesta.hayMas);
        setCargando(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setCargando(false);
      });
    return () => control.abort();
  }, [fecha, version, intento]);

  // La línea de "ahora" se mueve cada minuto.
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(intervalo);
  }, []);

  const columnas = useMemo(() => {
    const conReservas = new Set(reservas.map((r) => r.recurso.id));
    return (recursos ?? [])
      .filter((r) => r.estado !== 'inactivo' || conReservas.has(r.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [recursos, reservas]);

  const porRecurso = useMemo(() => {
    const mapa = new Map();
    for (const reserva of reservas) {
      if (!SE_DIBUJAN.has(reserva.estado)) continue;
      const lista = mapa.get(reserva.recurso.id) ?? [];
      lista.push(reserva);
      mapa.set(reserva.recurso.id, lista);
    }
    return new Map([...mapa].map(([id, lista]) => [id, repartirCarriles(lista)]));
  }, [reservas]);

  // Al cambiar de día (o al cargar), la grilla baja sola hasta la primera reserva, o hasta la hora
  // actual si es hoy y no hay reservas: así no hay que buscar el movimiento entre las 09:00 y las 21:00.
  useEffect(() => {
    if (cargando || !marco.current) return;
    const inicios = reservas.filter((r) => SE_DIBUJAN.has(r.estado)).map((r) => aMinutos(r.horaInicio));
    let objetivo = APERTURA_MIN;
    if (inicios.length > 0) objetivo = Math.min(...inicios) - 30;
    else if (fecha === hoy()) objetivo = new Date().getHours() * 60 + new Date().getMinutes() - 60;
    const y = Math.max(0, (objetivo - APERTURA_MIN) * PX_POR_MIN);
    marco.current.scrollTop = y;
  }, [cargando, reservas, fecha, columnas.length]);

  const esHoy = fecha === hoy();
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const lineaAhora = esHoy && minutosAhora >= APERTURA_MIN && minutosAhora <= CIERRE_MIN
    ? (minutosAhora - APERTURA_MIN) * PX_POR_MIN
    : null;
  // Lo que ya pasó (días anteriores o las horas de hoy que ya transcurrieron) no admite reservas nuevas.
  let altoPasado = 0;
  if (fecha < hoy()) altoPasado = ALTO;
  else if (esHoy) altoPasado = Math.min(ALTO, Math.max(0, (minutosAhora - APERTURA_MIN) * PX_POR_MIN));

  const horas = [];
  for (let h = APERTURA_MIN / 60; h < CIERRE_MIN / 60; h += 1) horas.push(h);

  function clicEnColumna(evento, recurso) {
    if (!puedeCrear || recurso.estado !== 'activo') return;
    if (evento.target !== evento.currentTarget) return; // fue sobre un bloque, no sobre un espacio libre
    const y = evento.clientY - evento.currentTarget.getBoundingClientRect().top;
    if (y < altoPasado) return; // ya pasó
    const minutos = APERTURA_MIN + Math.floor(y / PX_POR_MIN / BLOQUE_MIN) * BLOQUE_MIN;
    const hora = aHora(Math.min(Math.max(minutos, APERTURA_MIN), CIERRE_MIN - BLOQUE_MIN));
    onNueva({ recursoId: recurso.id, fecha, hora });
  }

  const hayReservas = [...porRecurso.values()].some((lista) => lista.length > 0);

  return (
    <div className="agenda" aria-busy={cargando || undefined}>
      <div className="agenda-barra">
        <div className="agenda-navegar">
          <button type="button" className="boton-icono" aria-label="Día anterior" onClick={() => onCambiarFecha(sumarDias(fecha, -1))}>
            <IconoFlechaIzquierda />
          </button>
          <input
            type="date"
            aria-label="Día de la agenda"
            value={fecha}
            onChange={(e) => e.target.value && onCambiarFecha(e.target.value)}
          />
          <button type="button" className="boton-icono" aria-label="Día siguiente" onClick={() => onCambiarFecha(sumarDias(fecha, 1))}>
            <IconoFlechaDerecha />
          </button>
          <button type="button" className="boton boton-chico boton-secundario" disabled={esHoy} onClick={() => onCambiarFecha(hoy())}>
            Hoy
          </button>
        </div>
        <p className="agenda-titulo" aria-live="polite">
          {mayuscula(formatearFechaLarga(fecha))}{esHoy ? ' · hoy' : ''}
        </p>
        <ul className="agenda-leyenda" aria-label="Colores">
          <li><span className="punto estado-pendiente_pago" />{ESTADOS_RESERVA.pendiente_pago}</li>
          <li><span className="punto estado-confirmada" />{ESTADOS_RESERVA.confirmada}</li>
        </ul>
      </div>

      {error && (
        <div className="tabla-vacia tabla-error" role="alert">
          <p>No se pudo cargar la agenda. {error}</p>
          <button type="button" className="boton boton-secundario" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
        </div>
      )}
      {!error && columnas.length === 0 && !cargando && (
        <p className="tabla-vacia">Aún no hay recursos para mostrar en la agenda.</p>
      )}

      {!error && columnas.length > 0 && (
        <>
          <p className="agenda-ayuda">
            {puedeCrear
              ? 'Haz clic en un espacio libre para reservar a esa hora, o en una reserva para ver su detalle.'
              : 'Haz clic en una reserva para ver su detalle.'}
            {!cargando && !hayReservas && ' No hay reservas este día.'}
            {hayMas && ' Se muestran las primeras 100 reservas del día.'}
          </p>
          <div className="agenda-marco" ref={marco}>
            <div
              className="agenda-grilla"
              style={{
                gridTemplateColumns: `3.5rem repeat(${columnas.length}, minmax(9.5rem, 1fr))`,
                '--alto-hora': `${60 * PX_POR_MIN}px`,
              }}
            >
              <div className="agenda-esquina" />
              {columnas.map((recurso) => (
                <div key={recurso.id} className="agenda-cabecera">
                  <strong>{recurso.nombre}</strong>
                  <span>
                    {recurso.estado === 'en_mantencion' ? 'En mantención' : `${TIPOS_RECURSO[recurso.tipo] ?? recurso.tipo} · hasta ${recurso.capacidadMaxima}`}
                  </span>
                </div>
              ))}

              <div className="agenda-horas" style={{ height: ALTO }} aria-hidden="true">
                {horas.map((h) => (
                  <span key={h} style={{ top: (h * 60 - APERTURA_MIN) * PX_POR_MIN }}>{aHora(h * 60)}</span>
                ))}
              </div>

              {columnas.map((recurso) => {
                const bloqueada = recurso.estado !== 'activo';
                return (
                  <div
                    key={recurso.id}
                    className={`agenda-columna${bloqueada ? ' agenda-bloqueada' : ''}${puedeCrear && !bloqueada ? ' agenda-libre' : ''}`}
                    style={{ height: ALTO }}
                    onClick={(e) => clicEnColumna(e, recurso)}
                  >
                    {altoPasado > 0 && <span className="agenda-pasado" style={{ height: altoPasado }} aria-hidden="true" />}
                    {lineaAhora !== null && <span className="agenda-ahora" style={{ top: lineaAhora }} aria-hidden="true" />}
                    {(porRecurso.get(recurso.id) ?? []).map(({ reserva, carril, carriles }) => {
                      const inicio = aMinutos(reserva.horaInicio);
                      const fin = aMinutos(reserva.horaFin);
                      const alto = Math.max((fin - inicio) * PX_POR_MIN - 2, 18);
                      return (
                        <button
                          key={reserva.id}
                          type="button"
                          className={`agenda-bloque bloque-${reserva.estado}${alto < 58 ? ' agenda-bloque-bajo' : ''}`}
                          style={{
                            top: (inicio - APERTURA_MIN) * PX_POR_MIN + 1,
                            height: alto,
                            left: `calc(${(carril * 100) / carriles}% + 2px)`,
                            width: `calc(${100 / carriles}% - 4px)`,
                          }}
                          aria-label={`${reserva.horaInicio} a ${reserva.horaFin}, ${reserva.cliente.nombre}, ${reserva.servicio.nombre}, ${reserva.cantidadPersonas} ${reserva.cantidadPersonas === 1 ? 'persona' : 'personas'}, ${ESTADOS_RESERVA[reserva.estado]}`}
                          onClick={() => onAbrir(reserva)}
                        >
                          <span className="bloque-hora">{reserva.horaInicio}–{reserva.horaFin}</span>
                          <span className="bloque-nombre">{reserva.cliente.nombre}</span>
                          <span className="bloque-detalle">
                            {reserva.servicio.nombre} · {reserva.cantidadPersonas} pers.
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
