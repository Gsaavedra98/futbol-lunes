export function ErrorCard({ message }: { message: string }) {
  return (
    <section className="card border-clay/30 bg-clay/10">
      <h1 className="text-xl font-black text-clay">{message}</h1>
      <p className="mt-2 text-sm font-semibold text-ink/70">
        Revisa las variables de entorno de Supabase en Vercel y vuelve a cargar la app.
      </p>
    </section>
  );
}
