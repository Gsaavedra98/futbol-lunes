import { cn } from "@/lib/utils";

const labels = {
  confirmed: "Confirmado",
  waitlist: "Lista de espera",
  cancelled: "Cancelado",
  replacement: "Reemplazo",
  pending: "Debe",
  paid: "Pagó",
  waived: "Sin deuda",
  open: "Abierto",
  closed: "Cerrado",
  finished: "Finalizado"
};

const tones = {
  confirmed: "bg-mint text-pitch",
  waitlist: "bg-sun/30 text-ink",
  cancelled: "bg-clay/15 text-clay",
  replacement: "bg-line text-pitch",
  pending: "bg-clay/15 text-clay",
  paid: "bg-mint text-pitch",
  waived: "bg-line text-pitch",
  open: "bg-mint text-pitch",
  closed: "bg-sun/30 text-ink",
  finished: "bg-ink/10 text-ink"
};

type Status = keyof typeof labels;

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  return <span className={cn("status-pill", tones[status], className)}>{labels[status]}</span>;
}
