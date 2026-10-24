// Estructura general: inicio de sesión, barra lateral con navegación y la pantalla activa.
// Sin sesión se muestra solo el login. Con sesión, el menú trae únicamente las secciones que el rol
// de la persona puede consultar (compartido/permisos.js).
// La sección activa se guarda en la dirección (#reservas, #clientes o #recursos), así el botón
// "atrás" del navegador funciona y se puede compartir el enlace a una sección.
import { useEffect, useMemo, useState } from 'react';
import { api, EVENTO_SESION_VENCIDA } from './api.js';
import Login from './paginas/Login.jsx';
import Reservas from './paginas/Reservas.jsx';
import Clientes from './paginas/Clientes.jsx';
import Recursos from './paginas/Recursos.jsx';
import { LogoNieveYSol } from './componentes/Logo.jsx';
import { ContextoSesion, crearSesion } from './componentes/Sesion.jsx';
import { IconoCalendario, IconoUsuarios, IconoRecursos, IconoSalir } from './componentes/Iconos.jsx';
import { iniciales } from './formato.js';
import { ROLES, SECCIONES } from '../../compartido/permisos.js';

const VISTAS = {
  reservas: { titulo: 'Reservas', Pantalla: Reservas, Icono: IconoCalendario },
  clientes: { titulo: 'Clientes', Pantalla: Clientes, Icono: IconoUsuarios },
  recursos: { titulo: 'Recursos', Pantalla: Recursos, Icono: IconoRecursos },
};

export default function App() {
  const [usuario, setUsuario] = useState(undefined); // undefined = comprobando | null = sin sesión
  const [aviso, setAviso] = useState('');

  // Al abrir la página: ¿ya hay una sesión abierta?
  useEffect(() => {
    api('GET', '/api/auth/yo')
      .then(({ usuario: persona }) => setUsuario(persona))
      .catch(() => setUsuario(null));
  }, []);

  // Si la sesión vence (o se cierra desde otra ventana), se vuelve al login con un aviso.
  useEffect(() => {
    function alVencer() {
      setAviso('Tu sesión expiró. Vuelve a ingresar.');
      setUsuario(null);
    }
    window.addEventListener(EVENTO_SESION_VENCIDA, alVencer);
    return () => window.removeEventListener(EVENTO_SESION_VENCIDA, alVencer);
  }, []);

  if (usuario === undefined) return <p className="cargando-inicial" role="status">Cargando…</p>;
  if (usuario === null) {
    return (
      <Login
        aviso={aviso}
        onEntrar={(persona) => {
          setAviso('');
          window.location.hash = '';
          setUsuario(persona);
        }}
      />
    );
  }

  async function cerrarSesion() {
    try {
      await api('POST', '/api/auth/logout');
    } catch {
      // aunque falle la red, en esta pantalla la sesión se da por cerrada
    }
    setAviso('');
    setUsuario(null);
  }

  return <Aplicacion usuario={usuario} onSalir={cerrarSesion} />;
}

function Aplicacion({ usuario, onSalir }) {
  const sesion = useMemo(() => crearSesion(usuario), [usuario]);
  const permitidas = SECCIONES.filter((seccion) => sesion.puede(seccion, 'leer'));

  const vistaDesdeDireccion = () => {
    const pedida = window.location.hash.slice(1);
    return permitidas.includes(pedida) ? pedida : permitidas[0];
  };

  // moverFoco: al navegar (no al abrir la página), el foco va al título de la sección,
  // para que un lector de pantalla anuncie el cambio.
  const [{ vista, moverFoco }, setNavegacion] = useState(() => ({ vista: vistaDesdeDireccion(), moverFoco: false }));

  useEffect(() => {
    function alCambiarDireccion() {
      setNavegacion({ vista: vistaDesdeDireccion(), moverFoco: true });
    }
    window.addEventListener('hashchange', alCambiarDireccion);
    return () => window.removeEventListener('hashchange', alCambiarDireccion);
  });

  useEffect(() => {
    document.title = `${VISTAS[vista].titulo} | Nieve y Sol`;
  }, [vista]);

  const { Pantalla } = VISTAS[vista];

  return (
    <ContextoSesion.Provider value={sesion}>
      <div className="marco">
        <aside className="riel">
          <a className="marca" href={`#${permitidas[0]}`}>
            <LogoNieveYSol />
            <span className="marca-texto">
              <span className="marca-nombre">Nieve <em>y</em> Sol</span>
              <small>Centro termal</small>
            </span>
          </a>
          <nav className="navegacion" aria-label="Secciones">
            {permitidas.map((clave) => {
              const { titulo, Icono } = VISTAS[clave];
              return (
                <a key={clave} href={`#${clave}`} data-vista={clave} aria-current={clave === vista ? 'page' : undefined}>
                  <Icono />
                  <span>{titulo}</span>
                </a>
              );
            })}
          </nav>
          <div className="riel-sesion">
            <span className="avatar" aria-hidden="true">{iniciales(usuario.nombre)}</span>
            <p className="riel-usuario">
              <strong>{usuario.nombre}</strong>
              <span>{ROLES[usuario.rol] ?? usuario.rol}</span>
            </p>
            <button type="button" className="boton-texto riel-salir" onClick={onSalir}>
              <IconoSalir />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </aside>

        <main className="contenido">
          {/* key={vista}: al cambiar de sección se monta la pantalla desde cero */}
          <Pantalla key={vista} moverFoco={moverFoco} />
        </main>
      </div>
    </ContextoSesion.Provider>
  );
}
