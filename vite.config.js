// Configuración de Vite (herramienta que compila el frontend en React).
// - npm run build     -> genera la carpeta dist/, que Express sirve en http://localhost:3000
// - npm run dev:front -> modo desarrollo en http://localhost:5173 (recarga al guardar);
//                        las llamadas a /api se redirigen al backend en el puerto 3000.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'frontend',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
