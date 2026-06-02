import { FollowUp } from '../entities/follow-up.entity';

export interface FollowUpSummary {
  lastFollowUpAt: string | null;
  daysSinceLastFollowUp: number | null;
  nextActionAt: string | null;
  nextActionOverdue: boolean;
  totalFollowUps: number;
}

export function buildFollowUpSummary(
  followUps: FollowUp[] | undefined,
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

  const withNext = list
    .filter((f) => f.nextActionAt)
    .map((f) => new Date(f.nextActionAt!));

  const upcoming = withNext
    .filter((d) => d.getTime() >= now.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  const overdueNext = withNext
    .filter((d) => d.getTime() < now.getTime())
    .sort((a, b) => b.getTime() - a.getTime());

  const nextDate = upcoming[0] ?? overdueNext[0] ?? null;

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
