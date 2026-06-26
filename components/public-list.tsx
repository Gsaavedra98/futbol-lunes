import type { RegistrationWithPlayer } from "@/lib/types";
import { StatusPill } from "./status-pill";

export function PublicList({
  title,
  registrations,
  empty,
  status,
  startAt = 1,
  counter,
  badgeLabel,
  rowBadgeLabel
}: {
  title: string;
  registrations: RegistrationWithPlayer[];
  empty: string;
  status: "confirmed" | "waitlist";
  startAt?: number;
  counter?: string;
  badgeLabel?: string;
  rowBadgeLabel?: string;
}) {
  return (
    <section className="card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-ink">{title}</h2>
          {counter ? <p className="mt-1 text-sm font-bold text-ink/55">{counter}</p> : null}
        </div>
        {badgeLabel ? (
          <span className={status === "waitlist" ? "status-pill bg-sun/30 text-ink" : "status-pill bg-mint text-pitch"}>
            {badgeLabel}
          </span>
        ) : null}
      </div>
      <div className="space-y-2">
        {registrations.length ? (
          registrations.map((registration, index) => (
            <div key={registration.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-ink/10 bg-white p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-line font-black text-pitch">
                  {startAt + index}
                </span>
                <span className="truncate font-bold text-ink">{registration.player.name}</span>
              </div>
              {rowBadgeLabel ? (
                <span className={status === "waitlist" ? "status-pill bg-sun/30 text-ink" : "status-pill bg-mint text-pitch"}>
                  {rowBadgeLabel}
                </span>
              ) : (
                <StatusPill status={status} className="shrink-0" />
              )}
            </div>
          ))
        ) : (
          <p className="rounded-lg bg-line/70 p-4 text-sm font-semibold text-ink/65">{empty}</p>
        )}
      </div>
    </section>
  );
}
