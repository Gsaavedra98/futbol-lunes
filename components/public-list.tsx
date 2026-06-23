import type { RegistrationWithPlayer } from "@/lib/types";
import { StatusPill } from "./status-pill";

export function PublicList({
  title,
  registrations,
  empty,
  status
}: {
  title: string;
  registrations: RegistrationWithPlayer[];
  empty: string;
  status: "confirmed" | "waitlist";
}) {
  return (
    <section className="card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-black text-ink">{title}</h2>
        <StatusPill status={status} />
      </div>
      <div className="space-y-2">
        {registrations.length ? (
          registrations.map((registration, index) => (
            <div key={registration.id} className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white p-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-line font-black text-pitch">
                {index + 1}
              </span>
              <span className="font-bold text-ink">{registration.player.name}</span>
            </div>
          ))
        ) : (
          <p className="rounded-lg bg-line/70 p-4 text-sm font-semibold text-ink/65">{empty}</p>
        )}
      </div>
    </section>
  );
}
