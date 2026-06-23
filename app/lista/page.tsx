"use client";

import { useEffect, useState } from "react";
import { LoadingCard } from "@/components/loading-card";
import { MatchSummary } from "@/components/match-summary";
import { PublicList } from "@/components/public-list";
import { getCurrentMatch, getData, getPublicLists } from "@/lib/store";
import type { Match, RegistrationWithPlayer } from "@/lib/types";

export default function ListPage() {
  const [match, setMatch] = useState<Match | null>(null);
  const [confirmed, setConfirmed] = useState<RegistrationWithPlayer[]>([]);
  const [waitlist, setWaitlist] = useState<RegistrationWithPlayer[]>([]);
  const [available, setAvailable] = useState(0);

  useEffect(() => {
    getData().then((data) => {
      const current = getCurrentMatch(data);
      if (!current) return;
      const lists = getPublicLists(data, current);
      setMatch(current);
      setConfirmed(lists.confirmed);
      setWaitlist(lists.waitlist);
      setAvailable(lists.available);
    });
  }, []);

  if (!match) {
    return <LoadingCard />;
  }

  return (
    <div className="grid gap-5">
      <MatchSummary match={match} />
      <div className="rounded-lg bg-pitch p-4 text-white">
        <span className="text-3xl font-black">{available}</span>
        <span className="ml-2 text-sm font-bold text-white/75">cupos disponibles</span>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <PublicList title="Confirmados" registrations={confirmed} empty="Todavía no hay confirmados." status="confirmed" />
        <PublicList title="Lista de espera" registrations={waitlist} empty="No hay jugadores en espera." status="waitlist" />
      </div>
    </div>
  );
}
