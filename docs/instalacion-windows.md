# Instalación en Windows, paso a paso

Guía para que cualquier integrante del equipo ejecute el sistema en su computador. Incluye los problemas que ya aparecieron al instalarlo y cómo resolverlos.

Cada computador tiene **su propia base de datos**. Los clientes que crees en tu equipo no aparecen en el de otro compañero. Para la demostración basta con un computador.

## 1. Instalar Node.js

1. Descargar la versión **LTS** desde nodejs.org e instalar con las opciones por defecto.
2. Abrir el **Símbolo del sistema** (cmd) y comprobar:
   ```
   node -v
   npm -v
   ```

Usar siempre **cmd**, no PowerShell (PowerShell puede bloquear `npm`).

## 2. Desactivar el Control inteligente de aplicaciones (si está activo)

Windows 11 puede bloquear PostgreSQL y las herramientas de compilación. Síntomas: el instalador de PostgreSQL dice *"La inicialización del clúster de la base de datos falló"*, o aparece *"Una directiva de Control de aplicaciones bloqueó este archivo"*.

1. Actualizar Windows (Configuración → Windows Update), para poder reactivarlo después.
2. Seguridad de Windows → Control de aplicaciones y navegador → Configuración de Control inteligente de aplicaciones → **Desactivado**.
3. Volver a activarlo cuando termine el ramo.

## 3. Instalar PostgreSQL

1. Descargar el instalador de EDB desde postgresql.org/download/windows.
2. **Clic derecho → Ejecutar como administrador.**
3. Componentes: *PostgreSQL Server* y *Command Line Tools* (pgAdmin es opcional).
4. Contraseña del usuario `postgres`: anotarla. Sin `@`, `#`, `/` ni `%`.
5. Puerto **5432**. Locale: **Spanish, Chile** (si falla, reinstalar eligiendo **C**).
6. Comprobar: Windows + R → `services.msc` → debe aparecer **postgresql-x64-18** "En ejecución".

Si una instalación falla: desinstalar PostgreSQL, borrar `C:\Program Files\PostgreSQL\18` y volver a instalar. El registro del instalador queda en `%TEMP%\install-postgresql.log`.

## 4. Preparar el proyecto

1. Copiar la carpeta del proyecto a `C:\Proyectos\nieve-y-sol`. **No dejarla en el Escritorio ni en Documentos si están dentro de OneDrive**: OneDrive intenta subir los miles de archivos de `node_modules` y provoca errores.
2. Entrar a la carpeta (donde está `package.json`), hacer clic en el espacio vacío de la barra de dirección, escribir `cmd` y presionar Enter.
3. En esa ventana:
   ```
   npm install
   npm run build
   copy .env.example .env
   notepad .env
   ```
4. En el Bloc de notas, reemplazar `TU_CLAVE` por la contraseña de PostgreSQL. Guardar y cerrar.
5. Crear la base de datos, las tablas y los datos de prueba:
   ```
   npm run db:seed
   ```

## 5. Ejecutar

```
npm start
```

Abrir **http://localhost:3000**. Para detener el sistema: Ctrl + C en la ventana negra.

## 6. Comprobar que todo funciona

Ver [casos-de-prueba.md](casos-de-prueba.md): verificación automática, casos manuales y qué requerimiento cubre cada uno.

## Problemas frecuentes

| Mensaje | Solución |
|---|---|
| `'node' no se reconoce…` | Cerrar y abrir cmd de nuevo; si sigue, reinstalar Node |
| `La clave de PostgreSQL en el archivo .env no es correcta` | Corregir la clave con `notepad .env` |
| `PostgreSQL no está encendido o no está instalado` | Revisar el servicio en `services.msc` (paso 3) |
| `EADDRINUSE ... 3000` | El sistema ya está abierto en otra ventana |
| `.env: not found` | Crear el archivo `.env` (paso 4) |
| La página dice "Falta compilar el frontend" | Ejecutar `npm run build` y luego `npm start` |
| Datos de prueba desordenados después de ensayar, o las reservas de ejemplo ya pasaron | `npm run db:reiniciar` |
| Falta la pantalla de Reservas o la API responde "relation reserva does not exist" | Ejecutar `npm run db:seed` (crea las tablas nuevas) y `npm run build` |
