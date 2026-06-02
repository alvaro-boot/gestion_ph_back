export enum StageType {
  MEETING = 'meeting',
  FORM = 'form',
  TASK = 'task',
  GENERAL = 'general',
}

export enum ClientProcessStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum StageProgressStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
  SKIPPED = 'skipped',
}

export enum MeetingStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export enum CalendarEventType {
  CLIENT_DELIVERY = 'client_delivery',
  INTERNAL_DELIVERY = 'internal_delivery',
}

export enum CalendarEventStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum FollowUpType {
  CALL = 'call',
  MEETING = 'meeting',
  EMAIL = 'email',
  VISIT = 'visit',
  NOTE = 'note',
  OTHER = 'other',
}
