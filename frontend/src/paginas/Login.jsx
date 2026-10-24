// Pantalla de inicio de sesión (RNF-03): sin sesión no se puede usar el sistema.
import { useEffect, useRef, useState } from 'react';
import { api, ErrorApi } from '../api.js';
import { CampoTexto } from '../componentes/Campos.jsx';
import { LogoNieveYSol } from '../componentes/Logo.jsx';
import { IconoOjo, IconoOjoTachado } from '../componentes/Iconos.jsx';

// onEntrar(usuario): se llama cuando el servidor abrió la sesión.
// aviso: texto opcional, por ejemplo "Tu sesión expiró".
export default function Login({ onEntrar, aviso }) {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState('');
  const [entrando, setEntrando] = useState(false);
  const campoCorreo = useRef(null);

  useEffect(() => {
    campoCorreo.current?.querySelector('input')?.focus();
  }, []);

  async function enviar(evento) {
    evento.preventDefault();
    const erroresLocales = {};
    if (correo.trim() === '') erroresLocales.correo = 'Escribe tu correo.';
    if (password === '') erroresLocales.password = 'Escribe tu contraseña.';
    setErrores(erroresLocales);
    setMensaje('');
    if (Object.keys(erroresLocales).length > 0) return;

    setEntrando(true);
    try {
      const { usuario } = await api('POST', '/api/auth/login', { correo: correo.trim(), password });
      onEntrar(usuario);
    } catch (err) {
      setEntrando(false);
      setPassword('');
      if (err instanceof ErrorApi && err.detalles) setErrores(err.detalles);
      else setMensaje(err.message);
    }
  }

  return (
    <main className="login">
      <section className="login-portada">
        <div className="login-portada-texto" aria-hidden="true">
          <LogoNieveYSol className="login-logo-grande" />
          <p className="login-lema">Centro termal</p>
          <h2>Nieve <em>y</em> Sol</h2>
          <p>Reservas, clientes y recursos del centro, en un solo lugar.</p>
        </div>
        <p className="login-credito">
          Foto:{' '}
          <a href="https://unsplash.com/photos/6hYzm40-byE" target="_blank" rel="noreferrer">Damian Patkowski</a>
          {' '}en Unsplash
        </p>
      </section>

      <div className="login-panel">
        <form className="login-tarjeta" noValidate onSubmit={enviar} aria-labelledby="login-titulo">
          <div className="login-marca">
            <LogoNieveYSol />
            <div>
              <h1 id="login-titulo">Nieve y Sol</h1>
              <p>Sistema de reserva de horas</p>
            </div>
          </div>

          <p className="login-bienvenida">Ingresa con tu cuenta para continuar.</p>

          {aviso && <p className="login-aviso" role="status">{aviso}</p>}
          {mensaje && <p className="login-error" role="alert">{mensaje}</p>}

          <div ref={campoCorreo}>
            <CampoTexto
              id="login-correo" nombre="correo" etiqueta="Correo" type="email" autoComplete="username"
              valor={correo} onCambio={setCorreo} error={errores.correo}
            />
          </div>

          <div className="campo">
            <label htmlFor="login-password">Contraseña</label>
            <div className="campo-clave">
              <input
                id="login-password"
                name="password"
                type={verClave ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={errores.password ? 'true' : undefined}
                aria-describedby="login-password-error"
              />
              <button
                type="button"
                className="boton-icono"
                aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={verClave}
                onClick={() => setVerClave((v) => !v)}
              >
                {verClave ? <IconoOjoTachado /> : <IconoOjo />}
              </button>
            </div>
            <p className="campo-error" id="login-password-error">{errores.password}</p>
          </div>

          <button type="submit" className="boton boton-principal login-boton" disabled={entrando}>
            {entrando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </main>
  );
}
