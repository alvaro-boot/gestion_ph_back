import { FollowUp } from '../entities/follow-up.entity';

export interface FollowUpSummary {
  lastFollowUpAt: string | null;
  daysSinceLastFollowUp: number | null;
  nextActionAt: string | null;
  nextActionOverdue: boolean;
  totalFollowUps: number;
}

/** Fechas en que ya hubo contacto (seguimiento o reunión/entrega cerrada). */
export function isNextActionFulfilled(
  nextActionAt: Date,
  followUps: FollowUp[],
  fulfilledAt: Date[],
): boolean {
  const nextMs = nextActionAt.getTime();

  const contactAfter = followUps.some(
    (f) => new Date(f.occurredAt).getTime() >= nextMs,
  );
  if (contactAfter) return true;

  return fulfilledAt.some((d) => d.getTime() >= nextMs);
}

export function buildFollowUpSummary(
  followUps: FollowUp[] | undefined,
  fulfilledAt: Date[] = [],
  clientNextContactAt: Date | null = null,
): FollowUpSummary {
  const list = followUps ?? [];
  const sorted = [...list].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  const last = sorted[0];
  const now = new Date();

  let daysSinceLastFollowUp: number | null = null;
  if (last) {
    const diff = now.getTime() - new Date(last.occurredAt).getTime();
    daysSinceLastFollowUp = Math.max(0, Math.floor(diff / 86400000));
  }

  let nextDate: Date | null = null;

  if (clientNextContactAt) {
    const at = new Date(clientNextContactAt);
    if (!isNextActionFulfilled(at, list, fulfilledAt)) {
      nextDate = at;
    }
  } else {
    const pendingNextMs = list
      .filter((f) => f.nextActionAt)
      .map((f) => new Date(f.nextActionAt!))
      .filter((nextDate) => !isNextActionFulfilled(nextDate, list, fulfilledAt))
      .map((d) => d.getTime());

    const upcoming = pendingNextMs
      .filter((ms) => ms >= now.getTime())
      .sort((a, b) => a - b);
    const overdueNext = pendingNextMs
      .filter((ms) => ms < now.getTime())
      .sort((a, b) => b - a);

    const nextMs = upcoming[0] ?? overdueNext[0] ?? null;
    nextDate = nextMs !== null ? new Date(nextMs) : null;
  }

  return {
    lastFollowUpAt: last ? new Date(last.occurredAt).toISOString() : null,
    daysSinceLastFollowUp,
    nextActionAt: nextDate ? nextDate.toISOString() : null,
    nextActionOverdue: nextDate ? nextDate.getTime() < now.getTime() : false,
    totalFollowUps: list.length,
  };
}

export interface FollowUpAlertRow {
  clientId: string;
  clientName: string;
  company: string | null;
  daysSinceLastFollowUp: number | null;
  lastFollowUpAt: string | null;
  nextActionAt: string | null;
  nextActionOverdue: boolean;
  totalFollowUps: number;
}
