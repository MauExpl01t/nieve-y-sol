// Prepara la base de datos en un solo paso:
//   1. Crea la base de datos indicada en DATABASE_URL si todavía no existe (no se necesita pgAdmin).
//   2. Crea las tablas (db/schema.sql).
//   3. Con --seed, carga los datos de prueba (db/seed.sql).
//   Con --reiniciar, antes borra las tablas: deja la base como recién instalada.
// Uso: npm run db:init   |   npm run db:seed   |   npm run db:reiniciar
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { hashear } from '../src/modulos/auth/clave.js';

// Personas de demostración, una por rol. Son contraseñas de prueba: cambiarlas (o crear usuarios
// propios con "npm run usuario:crear") antes de usar el sistema con datos reales.
const USUARIOS_DEMO = [
  { nombre: 'Administrador', correo: 'admin@nieveysol.cl', clave: 'Admin#2026', rol: 'administrador' },
  { nombre: 'Recepción', correo: 'recepcion@nieveysol.cl', clave: 'Recep#2026', rol: 'recepcionista' },
  { nombre: 'Supervisor', correo: 'supervisor@nieveysol.cl', clave: 'Super#2026', rol: 'supervisor' },
  { nombre: 'Mantenedor', correo: 'mantenedor@nieveysol.cl', clave: 'Mante#2026', rol: 'mantenedor' },
];

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. Copia .env.example como .env y complétalo.');
  process.exit(1);
}

const urlProyecto = new URL(process.env.DATABASE_URL);
const nombreBD = decodeURIComponent(urlProyecto.pathname.slice(1));
if (!/^[a-z_][a-z0-9_]*$/.test(nombreBD)) {
  console.error(`Nombre de base de datos no válido en DATABASE_URL: "${nombreBD}". Usa solo minúsculas, números y _.`);
  process.exit(1);
}

// Para crear la base de datos hay que conectarse a otra que siempre existe: "postgres".
const urlAdministracion = new URL(urlProyecto);
urlAdministracion.pathname = '/postgres';

const archivos = ['db/schema.sql'];
if (process.argv.includes('--seed')) archivos.push('db/seed.sql');

async function conConexion(url, tarea) {
  const conexion = new pg.Client({ connectionString: url.toString() });
  await conexion.connect();
  try {
    return await tarea(conexion);
  } finally {
    await conexion.end();
  }
}

// Mensajes claros para los errores más comunes al instalar.
function explicar(err) {
  if (err.code === 'ECONNREFUSED') {
    return 'PostgreSQL no está encendido o no está instalado. Revisa el servicio "postgresql" en services.msc.';
  }
  if (err.code === '28P01') return 'La clave de PostgreSQL en el archivo .env no es correcta.';
  return err.message;
}

try {
  await conConexion(urlAdministracion, async (conexion) => {
    const { rowCount } = await conexion.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombreBD]);
    if (rowCount === 0) {
      // CREATE DATABASE no acepta parámetros; el nombre ya fue validado arriba.
      await conexion.query(`CREATE DATABASE "${nombreBD}"`);
      console.log(`Base de datos creada: ${nombreBD}`);
    } else {
      console.log(`La base de datos ${nombreBD} ya existe.`);
    }
  });

  await conConexion(urlProyecto, async (conexion) => {
    if (process.argv.includes('--reiniciar')) {
      await conexion.query(
        'DROP TABLE IF EXISTS sesion, usuario, reserva, servicio_recurso, servicio, cliente, recurso CASCADE',
      );
      console.log('Tablas anteriores borradas.');
    }
    for (const archivo of archivos) {
      const sql = await readFile(new URL(`../${archivo}`, import.meta.url), 'utf8');
      await conexion.query(sql);
      console.log(`Listo: ${archivo}`);
    }

    // Siempre debe existir al menos el administrador, si no nadie podría iniciar sesión. Con --seed
    // se crean además las personas de demostración de los otros roles. Nunca pisa usuarios existentes.
    const conSeed = process.argv.includes('--seed');
    const { rows } = await conexion.query('SELECT count(*)::int AS n FROM usuario');
    if (rows[0].n === 0) {
      for (const u of conSeed ? USUARIOS_DEMO : USUARIOS_DEMO.slice(0, 1)) {
        await conexion.query(
          'INSERT INTO usuario (nombre, correo, password_hash, rol) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [u.nombre, u.correo, await hashear(u.clave), u.rol],
        );
      }
      console.log('Usuarios de demostración creados (ver README: "Inicio de sesión").');
    }
  });
} catch (err) {
  console.error(`No se pudo preparar la base de datos: ${explicar(err)}`);
  process.exitCode = 1;
}
