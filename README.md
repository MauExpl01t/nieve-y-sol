# Nieve y Sol: Sistema de reservas

Sistema web para reservar horas en un centro termal: administra **clientes**, **recursos** (salas, sauna, piscina, terapeutas, instructores) y **reservas**, con control de disponibilidad, agenda por día e inicio de sesión con roles.

> Proyecto en equipo desarrollado en INACAP. Estado: **Sprint 2** (en desarrollo).

## Tecnologías

| Capa | Tecnología |
|---|---|
| Backend | Node.js, Express (API REST) |
| Base de datos | PostgreSQL (SQL con consultas parametrizadas, sin ORM) |
| Frontend | React con Vite |
| Pruebas | Pruebas unitarias y pruebas de la API completa |

## Qué hace

- **Clientes y recursos:** crear, consultar, modificar y eliminar o desactivar, con búsqueda sin distinguir tildes, validación de RUT y filtros.
- **Reservas con disponibilidad:** el sistema verifica el cupo del recurso, soporta reservas de grupo y, si no hay cupo, sugiere los 3 horarios más cercanos.
- **Sin reservas duplicadas:** si dos personas reservan el último cupo al mismo tiempo, solo una se guarda (transacción con bloqueo).
- **Plazos:** una reserva pendiente de pago se libera sola a los 30 minutos; reprogramar y cancelar exigen 2 horas de anticipación.
- **Agenda por día:** una columna por recurso, con las reservas dibujadas por horario.
- **Ediciones simultáneas:** si dos personas modifican el mismo registro, la API lo detecta y responde `409 CONFLICTO_VERSION`.

## Seguridad

- **Inicio de sesión con roles** (Administrador, Recepcionista, Supervisor y Mantenedor). Cada rol ve y puede modificar solo lo que le corresponde, y el servidor lo exige en cada petición.
- **Contraseñas** guardadas solo como hash `scrypt`, con una sal distinta por persona.
- **Sesiones** con cookie `HttpOnly` y `SameSite=Lax`; en la base solo queda el hash del identificador.
- **Bloqueo tras 5 intentos fallidos** de ingreso por 10 minutos.
- **Respuestas iguales** para correo inexistente y contraseña errónea, para no revelar qué correos existen.
- **SQL parametrizado** en todos los repositorios, para evitar inyección SQL.

## Arquitectura

El backend sigue una arquitectura en capas por módulo:

```
rutas.js  ->  servicio.js  ->  repositorio.js
(HTTP y validación)  (reglas de negocio)  (consultas SQL)
```

Los módulos son `clientes`, `recursos`, `reservas`, `auth` y `servicios`. El código que comparten el navegador y el servidor (validación de RUT, horarios, permisos) está en `compartido/`.

## Cómo ejecutarlo

Requisitos: Node.js LTS (mínimo 20.19) y PostgreSQL 14 o superior.

```bash
npm install
cp .env.example .env     # en Windows: copy .env.example .env
# editar .env y poner la clave de tu PostgreSQL en DATABASE_URL
npm run db:seed          # crea la base de datos, las tablas y los datos de prueba
npm run build            # compila el frontend en React
npm start                # abre http://localhost:3000
```

Para correr las pruebas: `npm test`.

Guía detallada para Windows: [docs/instalacion-windows.md](docs/instalacion-windows.md).

### Usuarios de demostración

`npm run db:seed` crea una persona por rol. **Son credenciales de prueba para desarrollo local: cámbialas antes de usar el sistema con datos reales.**

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@nieveysol.cl` | `Admin#2026` |
| Recepcionista | `recepcion@nieveysol.cl` | `Recep#2026` |
| Supervisor | `supervisor@nieveysol.cl` | `Super#2026` |
| Mantenedor | `mantenedor@nieveysol.cl` | `Mante#2026` |

## Mi aporte

Proyecto en equipo, con trabajo organizado en sprints.

- **Backend (API REST en Node.js/Express):** rutas, servicios y repositorios con SQL parametrizado.
- **Inicio de sesión, roles y seguridad:** hash de contraseñas, sesiones, permisos por rol y bloqueo por intentos fallidos.
- **Scrum Master** del equipo.

El frontend en React fue desarrollado por el equipo.

## Documentación

- [Documentación completa del proyecto](docs/DOCUMENTACION.md): API, reglas de las reservas, códigos de error y decisiones de diseño.
- [Casos de prueba](docs/casos-de-prueba.md): cómo comprobar cada requerimiento.

## Créditos

Foto de la pantalla de inicio de sesión: Damian Patkowski, en [Unsplash](https://unsplash.com/photos/6hYzm40-byE) (licencia de Unsplash). El logo es un dibujo propio.
