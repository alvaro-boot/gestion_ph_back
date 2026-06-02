export function addCalendarDays(from: Date, days: number): Date {
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  return result;
}

export function computeStageDueDate(
  startedAt: Date,
  stage: {
    durationDays?: number | null;
    maxDurationDays?: number | null;
    minDurationDays?: number | null;
    formDeadlineDays?: number | null;
    stageType?: string;
  },
): Date | null {
  if (stage.formDeadlineDays) {
    return addCalendarDays(startedAt, stage.formDeadlineDays);
  }
  if (stage.durationDays) {
    return addCalendarDays(startedAt, stage.durationDays);
  }
  if (stage.maxDurationDays) {
    return addCalendarDays(startedAt, stage.maxDurationDays);
  }
  if (stage.minDurationDays) {
    return addCalendarDays(startedAt, stage.minDurationDays);
  }
  return null;
}
