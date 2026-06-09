import { FollowUpSummary } from '../common/follow-up-summary';

export interface ConjuntoReportClient {
  id: string;
  name: string;
  company: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
}

export interface ConjuntoReportFollowUp {
  id: string;
  title: string;
  description: string | null;
  followUpType: string;
  occurredAt: string;
  nextActionAt: string | null;
  stageName: string | null;
}

export interface ConjuntoReportStage {
  id: string;
  orderIndex: number;
  name: string;
  stageType: string;
  status: string;
  startedAt: string | null;
  dueDate: string | null;
  completedAt: string | null;
  overdue: boolean;
  durationLabel: string;
  isCurrent: boolean;
}

export interface ConjuntoReportProcess {
  id: string;
  templateName: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  currentStageName: string | null;
  stages: ConjuntoReportStage[];
}

export interface ConjuntoReportMeeting {
  id: string;
  title: string;
  scheduledAt: string;
  status: string;
  stageName: string | null;
  source: 'stage' | 'followup';
  activityType?: 'meeting' | 'call' | 'visit' | 'other';
  notes?: string | null;
}

export interface ConjuntoReportDelivery {
  id: string;
  title: string;
  dueAt: string;
  status: string;
  eventType: 'client_delivery' | 'internal_delivery';
  description: string | null;
  unfulfilledReason: string | null;
  overdue: boolean;
}

export interface ConjuntoReportNextContact {
  followUpId: string;
  title: string;
  at: string;
  overdue: boolean;
}

export interface ConjuntoReport {
  client: ConjuntoReportClient;
  followUpSummary: FollowUpSummary;
  lastFollowUp: ConjuntoReportFollowUp | null;
  recentFollowUps: ConjuntoReportFollowUp[];
  pendingNextContacts: ConjuntoReportNextContact[];
  process: ConjuntoReportProcess | null;
  plannedMeetings: ConjuntoReportMeeting[];
  deliveries: ConjuntoReportDelivery[];
}
