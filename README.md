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
- Configuración de llave de pago por partido y reporte de pagos sin pasarela.
- Resumen copiable para WhatsApp.
- PWA con manifest, service worker e ícono temporal.
- Fallback local con datos mock solo para demo en desarrollo.

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
# Opcional si tu proyecto usa publishable keys nuevas:
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu-publishable-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
ADMIN_PASSWORD=una-clave-segura
```

`SUPABASE_SERVICE_ROLE_KEY` nunca debe tener prefijo `NEXT_PUBLIC`. Esa clave solo se usa del lado del servidor para el panel administrador.

Si no configuras Supabase, la app solo usa `localStorage` como demo en desarrollo. En producción Supabase es obligatorio.

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

Si ya tienes la base creada, vuelve a ejecutar `supabase/schema.sql` después de actualizar el proyecto. El script agrega campos de pago al partido, amplía estados de `payments` y actualiza la vista pública para mostrar solo `Pagado` o `Pendiente`.

El script habilita Row Level Security en todas las tablas y deja al público con acceso mínimo:

- Ver partido activo.
- Ver lista pública sin teléfonos.
- Crear inscripción mediante RPC controlada.
- Crear cancelación mediante RPC controlada.

Pagos, asistencia, deudas y decisiones administrativas no pueden gestionarse con la anon key.

## Uso En Producción

Para uso real desde Vercel, configura estas variables en el proyecto:

```bash
NEXT_PUBLIC_SUPABASE_URL=tu-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
# Opcional si tu proyecto usa publishable keys nuevas:
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu-publishable-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
ADMIN_PASSWORD=una-clave-segura
```

Importante:

- `SUPABASE_SERVICE_ROLE_KEY` no debe tener prefijo `NEXT_PUBLIC`.
- No guardes `SUPABASE_SERVICE_ROLE_KEY` en código fuente.
- `localStorage` es solo para demo local en `NODE_ENV=development`.
- En producción, si faltan variables de Supabase, la app muestra “La base de datos no está configurada”.

Pasos:

1. Ejecuta `supabase/schema.sql` en el SQL editor de Supabase.
2. Copia `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` desde Supabase. Si tu proyecto usa publishable keys nuevas, puedes configurar `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Copia `SUPABASE_SERVICE_ROLE_KEY` desde Supabase Project Settings > API.
4. Configura `ADMIN_PASSWORD` en Vercel.
5. Despliega en Vercel.

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
