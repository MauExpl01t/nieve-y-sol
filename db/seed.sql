-- Datos de prueba para la demostración. Se pueden cargar varias veces sin duplicar.

INSERT INTO cliente (nombre, rut) VALUES
  ('Camila Fuentes Soto', '15432876-9'),
  ('Jorge Riquelme Díaz', '9876543-3'),
  ('Valentina Muñoz Pérez', '17654321-3'),
  ('Tomás Contreras Vera', '20123456-5'),
  ('Francisca Lagos Ibáñez', '8765432-K')
ON CONFLICT DO NOTHING;

INSERT INTO recurso (nombre, tipo, capacidad_maxima, estado) VALUES
  ('Sauna seca', 'sauna', 8, 'activo'),
  ('Piscina termal exterior', 'piscina', 40, 'activo'),
  ('Sala de masajes 1', 'sala', 2, 'activo'),
  ('Sala multiuso', 'sala', 20, 'en_mantencion'),
  ('Masoterapeuta turno mañana', 'terapeuta', 1, 'activo'),
  ('Instructor de yoga', 'instructor', 15, 'activo')
ON CONFLICT DO NOTHING;

INSERT INTO servicio (nombre, duracion_min, precio) VALUES
  ('Masaje descontracturante', 60, 35000),
  ('Sesión de sauna', 45, 12000),
  ('Piscina termal', 90, 15000),
  ('Clase de yoga', 60, 10000)
ON CONFLICT DO NOTHING;

INSERT INTO servicio_recurso (servicio_id, recurso_id)
SELECT s.id, r.id
  FROM (VALUES
         ('Masaje descontracturante', 'Masoterapeuta turno mañana'),
         ('Masaje descontracturante', 'Sala de masajes 1'),
         ('Sesión de sauna', 'Sauna seca'),
         ('Piscina termal', 'Piscina termal exterior'),
         ('Clase de yoga', 'Instructor de yoga'),
         ('Clase de yoga', 'Sala multiuso')
       ) AS v (servicio, recurso)
  JOIN servicio s ON s.nombre = v.servicio
  JOIN recurso r ON r.nombre = v.recurso
ON CONFLICT DO NOTHING;

-- Reservas de ejemplo para mañana y pasado mañana (hora de Chile).
-- Solo se cargan si la tabla está vacía, para no duplicarlas.
INSERT INTO reserva (cliente_id, servicio_id, recurso_id, inicio, fin, cantidad_personas, estado)
SELECT c.id, s.id, r.id,
       ((now() AT TIME ZONE 'America/Santiago')::date + v.dias + v.hora::time) AT TIME ZONE 'America/Santiago',
       ((now() AT TIME ZONE 'America/Santiago')::date + v.dias + v.hora::time
         + make_interval(mins => s.duracion_min)) AT TIME ZONE 'America/Santiago',
       v.personas,
       v.estado
  FROM (VALUES
         ('15432876-9', 'Masaje descontracturante', 'Masoterapeuta turno mañana', 1, '10:00', 1, 'confirmada'),
         ('9876543-3', 'Sesión de sauna', 'Sauna seca', 1, '11:00', 3, 'pendiente_pago'),
         ('17654321-3', 'Piscina termal', 'Piscina termal exterior', 1, '16:00', 6, 'confirmada'),
         ('20123456-5', 'Masaje descontracturante', 'Masoterapeuta turno mañana', 2, '15:00', 1, 'pendiente_pago')
       ) AS v (rut, servicio, recurso, dias, hora, personas, estado)
  JOIN cliente c ON c.rut = v.rut
  JOIN servicio s ON s.nombre = v.servicio
  JOIN recurso r ON r.nombre = v.recurso
 WHERE NOT EXISTS (SELECT 1 FROM reserva);
