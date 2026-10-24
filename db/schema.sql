-- Esquema de la base de datos: Clientes, Recursos, Servicios y Reservas (Sprint 2).
-- Requiere PostgreSQL 13 o superior (gen_random_uuid viene incluido).
-- Las reglas que nunca deben romperse están aquí, no solo en el código:
-- si el código tuviera un error, la base de datos igual rechaza el dato inválido.

CREATE TABLE IF NOT EXISTS cliente (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text NOT NULL CHECK (char_length(nombre) BETWEEN 2 AND 120),
  rut            text NOT NULL
                 CONSTRAINT cliente_rut_unico UNIQUE
                 CHECK (rut ~ '^[1-9][0-9]{6,7}-[0-9K]$'),
  -- NULL significa que el cliente aún no tiene cuenta web (por ejemplo, lo registró recepción).
  -- La contraseña la define el módulo de autenticación, no este CRUD.
  password_hash  text,
  estado         text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  -- Sube en 1 con cada modificación. Si dos personas editan a la vez, la segunda se rechaza (409).
  version        integer NOT NULL DEFAULT 1,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cliente_nombre_idx ON cliente (nombre, id);

CREATE TABLE IF NOT EXISTS recurso (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           text NOT NULL CHECK (char_length(nombre) BETWEEN 2 AND 120),
  tipo             text NOT NULL CHECK (tipo IN ('sala', 'sauna', 'piscina', 'terapeuta', 'instructor')),
  capacidad_maxima integer NOT NULL CHECK (capacidad_maxima BETWEEN 1 AND 1000),
  estado           text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'en_mantencion', 'inactivo')),
  creado_en        timestamptz NOT NULL DEFAULT now(),
  actualizado_en   timestamptz NOT NULL DEFAULT now()
);

-- Dos recursos no pueden llamarse igual (sin importar mayúsculas): evita "Sauna 1" y "sauna 1".
CREATE UNIQUE INDEX IF NOT EXISTS recurso_nombre_unico ON recurso (lower(nombre));
CREATE INDEX IF NOT EXISTS recurso_nombre_idx ON recurso (nombre, id);

-- ============ Servicios y Reservas ============

-- Catálogo de servicios (masajes, sauna, clases). Por ahora se carga con datos de prueba;
-- su CRUD con pantalla es un módulo posterior.
CREATE TABLE IF NOT EXISTS servicio (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL CHECK (char_length(nombre) BETWEEN 2 AND 120),
  -- La duración usa bloques de 15 minutos, igual que las horas de reserva.
  duracion_min integer NOT NULL CHECK (duracion_min BETWEEN 15 AND 480 AND duracion_min % 15 = 0),
  precio       integer NOT NULL CHECK (precio >= 0), -- en pesos chilenos
  activo       boolean NOT NULL DEFAULT true,
  creado_en    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS servicio_nombre_unico ON servicio (lower(nombre));

-- Qué recursos pueden atender cada servicio (relación "requiere" del diagrama de clases).
CREATE TABLE IF NOT EXISTS servicio_recurso (
  servicio_id uuid NOT NULL REFERENCES servicio (id) ON DELETE CASCADE,
  recurso_id  uuid NOT NULL REFERENCES recurso (id) ON DELETE CASCADE,
  PRIMARY KEY (servicio_id, recurso_id)
);

CREATE INDEX IF NOT EXISTS servicio_recurso_recurso_idx ON servicio_recurso (recurso_id);

CREATE TABLE IF NOT EXISTS reserva (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT: no se puede borrar un cliente, servicio o recurso que tenga reservas.
  cliente_id     uuid NOT NULL REFERENCES cliente (id) ON DELETE RESTRICT,
  servicio_id    uuid NOT NULL REFERENCES servicio (id) ON DELETE RESTRICT,
  recurso_id     uuid NOT NULL REFERENCES recurso (id) ON DELETE RESTRICT,
  inicio         timestamptz NOT NULL,
  fin            timestamptz NOT NULL,
  -- Cuántas personas incluye la reserva (un grupo ocupa tantos cupos del recurso como personas lleva).
  cantidad_personas integer NOT NULL DEFAULT 1 CHECK (cantidad_personas BETWEEN 1 AND 1000),
  estado         text NOT NULL DEFAULT 'pendiente_pago'
                 CHECK (estado IN ('pendiente_pago', 'confirmada', 'completada', 'cancelada', 'liberada', 'no_show')),
  version        integer NOT NULL DEFAULT 1, -- ver cliente.version
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserva_fin_despues_de_inicio CHECK (fin > inicio)
);

CREATE INDEX IF NOT EXISTS reserva_recurso_inicio_idx ON reserva (recurso_id, inicio);
CREATE INDEX IF NOT EXISTS reserva_cliente_inicio_idx ON reserva (cliente_id, inicio);
CREATE INDEX IF NOT EXISTS reserva_inicio_idx ON reserva (inicio);
CREATE INDEX IF NOT EXISTS reserva_servicio_idx ON reserva (servicio_id);

-- Para bases creadas antes de existir la columna version (db:init las actualiza sin borrar datos).
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE reserva ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE reserva ADD COLUMN IF NOT EXISTS cantidad_personas integer NOT NULL DEFAULT 1
  CHECK (cantidad_personas BETWEEN 1 AND 1000);

-- ============ Usuarios y sesiones (inicio de sesión, RF-08 y RNF-03) ============

-- Personas que usan el sistema (el personal del centro). Son distintas de los clientes que reservan.
-- La contraseña nunca se guarda: solo su "hash" (scrypt con sal), que no se puede revertir.
CREATE TABLE IF NOT EXISTS usuario (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text NOT NULL CHECK (char_length(nombre) BETWEEN 2 AND 120),
  correo         text NOT NULL
                 CONSTRAINT usuario_correo_unico UNIQUE
                 CHECK (correo = lower(correo) AND correo ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
  password_hash  text NOT NULL,
  -- Valores iguales a ROLES de compartido/permisos.js
  rol            text NOT NULL CHECK (rol IN ('administrador', 'supervisor', 'recepcionista', 'mantenedor')),
  estado         text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- Una fila por sesión abierta. Se guarda el hash del identificador que viaja en la cookie, no el
-- identificador: si alguien leyera esta tabla no podría usar las sesiones. Cerrar sesión borra la fila.
CREATE TABLE IF NOT EXISTS sesion (
  token_hash  text PRIMARY KEY,
  usuario_id  uuid NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
  creada_en   timestamptz NOT NULL DEFAULT now(),
  expira_en   timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sesion_usuario_idx ON sesion (usuario_id);
CREATE INDEX IF NOT EXISTS sesion_expira_idx ON sesion (expira_en);
