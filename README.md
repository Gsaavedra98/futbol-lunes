# Fútbol Lunes

PWA mobile-first para organizar un grupo de WhatsApp que juega fútbol todos los lunes. Permite que los jugadores se anoten, cancelen asistencia y revisen si quedaron confirmados o en lista de espera. El administrador puede controlar cupos, cancelaciones, asistencia, pagos, deudas y generar un resumen listo para WhatsApp.

## Problema Que Resuelve

En muchos grupos de fútbol la organización ocurre en mensajes sueltos: se pierde el orden de inscripción, no queda claro quién debe pagar si cancela tarde y el administrador termina armando listas a mano. Fútbol Lunes centraliza ese flujo en una app simple que funciona bien desde celular.

## Funcionalidades

- Inscripción pública sin login.
- Cálculo automático de confirmados y lista de espera.
- Cancelación con registro de reemplazo y posible deuda.
- Vista pública de confirmados, espera y cupos disponibles.
- Panel admin protegido por `ADMIN_PASSWORD`.
- Edición de partido semanal: fecha, hora, lugar, valor, cupo y estado.
- Cambio manual de estado de inscritos.
- Revisión de cancelaciones y decisión de deuda.
- Control de asistencia, pagos y deudas.
- Resumen copiable para WhatsApp.
- PWA con manifest, service worker e ícono temporal.
- Fallback local con datos mock para demo de portafolio.

## Stack

- Next.js con App Router
- TypeScript
- Tailwind CSS
- Supabase
- PWA básica con manifest y service worker

## Variables De Entorno

Crea un archivo `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=tu-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
ADMIN_PASSWORD=una-clave-segura
```

Si no configuras Supabase, la app usa `localStorage` con datos de prueba para facilitar la demo.

## Correr Localmente

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

La clave admin por defecto, solo cuando no existe `ADMIN_PASSWORD`, es:

```bash
admin123
```

## Supabase

Ejecuta el script:

```bash
supabase/schema.sql
```

El script crea las tablas:

- `matches`
- `players`
- `registrations`
- `cancellations`
- `payments`
- `attendance`

También inserta un partido de prueba, 15 jugadores, 12 confirmados y 3 en lista de espera.

## Despliegue

1. Sube el proyecto a GitHub.
2. Crea el proyecto en Vercel.
3. Agrega las variables de entorno.
4. Ejecuta el SQL en Supabase.
5. Despliega.

## Capturas Sugeridas Para Portafolio

- Inicio en móvil con fecha, lugar, valor y cupos.
- Resultado de inscripción confirmado/lista de espera.
- Vista pública de lista.
- Panel admin con inscritos y cancelaciones.
- Generador de mensaje para WhatsApp.

## Mejoras Futuras

- Autenticación real para administradores.
- Reglas de seguridad RLS más estrictas en Supabase.
- Envío automático a WhatsApp.
- Historial de partidos anteriores.
- Confirmaciones por teléfono.
- Exportación de pagos y asistencia.
