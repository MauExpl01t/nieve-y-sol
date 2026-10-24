// Punto de entrada del frontend: monta la aplicación React dentro de <div id="raiz">.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ProveedorAvisos } from './componentes/Avisos.jsx';
import './estilos.css';

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <ProveedorAvisos>
      <App />
    </ProveedorAvisos>
  </StrictMode>,
);
