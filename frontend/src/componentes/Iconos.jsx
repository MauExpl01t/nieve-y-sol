// Íconos de línea (24x24) para el menú, los botones y los avisos. Son decorativos: el texto que los
// acompaña (o el aria-label del botón) es lo que leen los lectores de pantalla.

function Icono({ children, tam = '1.25rem', relleno = false }) {
  return (
    <svg
      className="icono"
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill={relleno ? 'currentColor' : 'none'}
      stroke={relleno ? 'none' : 'currentColor'}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconoCalendario = (p) => (
  <Icono {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <path d="M8 14h2M14 14h2M8 17.5h2" />
  </Icono>
);

export const IconoUsuarios = (p) => (
  <Icono {...p}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M2.8 20c0-3.4 2.8-5.8 6.2-5.8s6.2 2.4 6.2 5.8" />
    <path d="M16 5.3a3.3 3.3 0 0 1 0 6.4M18.2 14.6c1.9.7 3.1 2.6 3.1 5.4" />
  </Icono>
);

export const IconoRecursos = (p) => (
  <Icono {...p}>
    <path d="M12 3.2s-6.5 6.6-6.5 11.1a6.5 6.5 0 0 0 13 0C18.5 9.8 12 3.2 12 3.2Z" />
    <path d="M9.2 14.6a2.9 2.9 0 0 0 2.4 2.7" />
  </Icono>
);

export const IconoLista = (p) => (
  <Icono {...p}>
    <path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20" />
    <circle cx="4.5" cy="6.5" r="0.9" fill="currentColor" />
    <circle cx="4.5" cy="12" r="0.9" fill="currentColor" />
    <circle cx="4.5" cy="17.5" r="0.9" fill="currentColor" />
  </Icono>
);

export const IconoAgenda = (p) => (
  <Icono {...p}>
    <rect x="3.5" y="4" width="17" height="16.5" rx="2.5" />
    <path d="M9.2 4v16.5M14.8 4v16.5M3.5 10h17" />
  </Icono>
);

export const IconoMas = (p) => (
  <Icono {...p} relleno>
    <circle cx="5.5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="18.5" cy="12" r="1.8" />
  </Icono>
);

export const IconoMenos = (p) => (
  <Icono {...p}>
    <path d="M5 12h14" />
  </Icono>
);

export const IconoFlechaIzquierda = (p) => (
  <Icono {...p}>
    <path d="m14.5 6-6 6 6 6" />
  </Icono>
);

export const IconoFlechaDerecha = (p) => (
  <Icono {...p}>
    <path d="m9.5 6 6 6-6 6" />
  </Icono>
);

export const IconoReloj = (p) => (
  <Icono {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icono>
);

export const IconoPersonas = (p) => (
  <Icono {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 20c.4-3.6 3.2-5.8 7.2-5.8s6.8 2.2 7.2 5.8" />
  </Icono>
);

export const IconoOk = (p) => (
  <Icono {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.4 2.6 2.6L16 9.4" />
  </Icono>
);

export const IconoAlerta = (p) => (
  <Icono {...p}>
    <path d="M12 3.6 2.8 19.4h18.4L12 3.6Z" />
    <path d="M12 10v4.4M12 17v.1" />
  </Icono>
);

export const IconoOjo = (p) => (
  <Icono {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Icono>
);

export const IconoOjoTachado = (p) => (
  <Icono {...p}>
    <path d="M10.2 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.5 3.3M6.4 7.4C3.9 9 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.5 0 2.8-.4 4-1" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3.5 3.5l17 17" />
  </Icono>
);

export const IconoSalir = (p) => (
  <Icono {...p}>
    <path d="M14 4.5h4.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H14" />
    <path d="M10 8l-4 4 4 4M6 12h10" />
  </Icono>
);

// Ícono grande para las listas vacías.
export const IconoVacio = (p) => (
  <Icono tam="2.25rem" {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4M9.5 15.2h5" />
  </Icono>
);
