import type { AppData } from "./types";

const created = "2026-06-20T13:00:00.000Z";

const names = [
  "Andrés Rojas",
  "Camilo Pérez",
  "Santiago Mora",
  "Felipe Gómez",
  "Juan Herrera",
  "Diego Castro",
  "Nicolás Vega",
  "Mateo Arias",
  "Luis Medina",
  "Carlos Duarte",
  "Sebastián León",
  "Tomás Rincón",
  "Iván Salazar",
  "Daniel Torres",
  "Miguel Cárdenas"
];

export const seedData: AppData = {
  matches: [
    {
      id: "match-1",
      date: "2026-06-29",
      time: "8:00 p.m.",
      location: "Cancha sintética La 70",
      price_per_player: 18000,
      active_capacity: 12,
      status: "open",
      created_at: created
    }
  ],
  players: names.map((name, index) => ({
    id: `player-${index + 1}`,
    name,
    phone: index < 4 ? `30000000${index + 1}` : null,
    created_at: new Date(Date.parse(created) + index * 1000 * 60 * 12).toISOString()
  })),
  registrations: names.map((_, index) => ({
    id: `registration-${index + 1}`,
    match_id: "match-1",
    player_id: `player-${index + 1}`,
    position: index + 1,
    status: index < 12 ? "confirmed" : "waitlist",
    accepted_terms: true,
    created_at: new Date(Date.parse(created) + index * 1000 * 60 * 12).toISOString()
  })),
  cancellations: [
    {
      id: "cancellation-1",
      match_id: "match-1",
      player_id: "player-4",
      action_type: "cancel",
      declared_status: "confirmed",
      has_replacement: false,
      replacement_name: null,
      note: "Me salió turno en el trabajo.",
      admin_decision: "debt",
      created_at: "2026-06-29T14:30:00.000Z"
    }
  ],
  payments: [
    {
      id: "payment-1",
      match_id: "match-1",
      player_id: "player-4",
      amount: 18000,
      status: "pending",
      reason: "Canceló el mismo lunes sin reemplazo",
      created_at: "2026-06-29T14:32:00.000Z"
    }
  ],
  attendance: [
    {
      id: "attendance-1",
      match_id: "match-1",
      player_id: "player-1",
      attended: true,
      notes: null,
      created_at: "2026-06-29T22:30:00.000Z"
    }
  ]
};
