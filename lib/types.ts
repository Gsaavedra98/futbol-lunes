export type MatchStatus = "open" | "closed" | "finished";
export type RegistrationStatus = "confirmed" | "waitlist" | "cancelled" | "replacement";
export type CancellationAction = "cancel" | "cancel_with_replacement" | "replacement";
export type DeclaredStatus = "confirmed" | "waitlist" | "unknown";
export type AdminDecision = "pending" | "waived" | "debt" | "replaced";
export type PaymentStatus = "pending" | "pending_review" | "paid" | "rejected" | "debt" | "waived";

export type Match = {
  id: string;
  date: string;
  time: string;
  location: string;
  price_per_player: number;
  payment_responsible_name?: string | null;
  payment_key?: string | null;
  payment_key_type?: string | null;
  payment_deadline?: string | null;
  payment_note?: string | null;
  active_capacity: 12 | 18 | 20;
  status: MatchStatus;
  created_at: string;
};

export type Player = {
  id: string;
  name: string;
  phone?: string | null;
  created_at: string;
};

export type Registration = {
  id: string;
  match_id: string;
  player_id: string;
  position: number;
  status: RegistrationStatus;
  payment_status?: PaymentStatus | null;
  accepted_terms: boolean;
  created_at: string;
};

export type Cancellation = {
  id: string;
  match_id: string;
  player_id: string;
  action_type: CancellationAction;
  declared_status: DeclaredStatus;
  previous_status?: RegistrationStatus | null;
  has_replacement: boolean;
  replacement_name?: string | null;
  note?: string | null;
  admin_decision: AdminDecision;
  possible_debt?: boolean;
  promoted_player_id?: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  match_id: string;
  player_id: string;
  amount: number;
  status: PaymentStatus;
  method?: string | null;
  reference?: string | null;
  comment?: string | null;
  reported_amount?: number | null;
  reported_at?: string | null;
  reason?: string | null;
  created_at: string;
};

export type Attendance = {
  id: string;
  match_id: string;
  player_id: string;
  attended: boolean;
  notes?: string | null;
  created_at: string;
};

export type AppData = {
  matches: Match[];
  players: Player[];
  registrations: Registration[];
  cancellations: Cancellation[];
  payments: Payment[];
  attendance: Attendance[];
};

export type RegistrationWithPlayer = Registration & {
  player: Player;
};

export type CancellationWithPlayer = Cancellation & {
  player: Player;
  promoted_player?: Player | null;
};
