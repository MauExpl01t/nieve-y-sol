// Crea una persona que puede iniciar sesión en el sistema.
// Uso:  npm run usuario:crear -- <correo> <rol> "<Nombre completo>" [contraseña]
//   rol: administrador | supervisor | recepcionista | mantenedor
// Si no se indica la contraseña, se genera una al azar y se muestra una sola vez en pantalla.
// Ejemplo:  npm run usuario:crear -- ana@nieveysol.cl recepcionista "Ana Pérez"
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { hashear, problemaDeClave } from '../src/modulos/auth/clave.js';
import { ROLES } from '../compartido/permisos.js';

const [correoCrudo, rol, nombre, claveIndicada] = process.argv.slice(2);

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. Copia .env.example como .env y complétalo.');
  process.exit(1);
}
if (!correoCrudo || !rol || !nombre) {
  console.error('Uso: npm run usuario:crear -- <correo> <rol> "<Nombre completo>" [contraseña]');
  console.error(`Roles: ${Object.keys(ROLES).join(', ')}`);
  process.exit(1);
}
const correo = correoCrudo.trim().toLowerCase();
if (!Object.hasOwn(ROLES, rol)) {
  console.error(`Rol no válido: "${rol}". Usa uno de: ${Object.keys(ROLES).join(', ')}.`);
  process.exit(1);
}
const clave = claveIndicada ?? randomBytes(9).toString('base64url');
const problema = problemaDeClave(clave);
if (problema) {
  console.error(problema);
  process.exit(1);
}

const conexion = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await conexion.connect();
  await conexion.query(
    'INSERT INTO usuario (nombre, correo, password_hash, rol) VALUES ($1, $2, $3, $4)',
    [nombre.trim(), correo, await hashear(clave), rol],
  );
  console.log(`Usuario creado: ${correo} (${ROLES[rol]})`);
  if (!claveIndicada) console.log(`Contraseña generada: ${clave}  (anótala: no se vuelve a mostrar)`);
} catch (err) {
  if (err.code === '23505') console.error(`Ya existe un usuario con el correo ${correo}.`);
  else if (err.code === '23514') console.error('Datos no válidos: revisa el correo y el nombre.');
  else if (err.code === '42P01') console.error('Faltan las tablas. Ejecuta primero: npm run db:init');
  else console.error(`No se pudo crear el usuario: ${err.message || err.code}`);
  process.exitCode = 1;
} finally {
  await conexion.end();
}
