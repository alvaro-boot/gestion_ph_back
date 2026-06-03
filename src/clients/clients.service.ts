import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Client } from '../entities/client.entity';
import { ClientProcess } from '../entities/client-process.entity';
import { FollowUp } from '../entities/follow-up.entity';
import { ClientUpdateLog, ClientFieldChange } from '../entities/client-update-log.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import {
  CLIENT_EDITABLE_FIELDS,
  CLIENT_FIELD_LABELS,
  formatClientFieldValue,
} from '../common/client-fields';
import {
  buildFollowUpSummary,
  FollowUpAlertRow,
  FollowUpSummary,
  isNextActionFulfilled,
} from '../common/follow-up-summary';
import {
  ConjuntoReport,
  ConjuntoReportDelivery,
  ConjuntoReportFollowUp,
  ConjuntoReportMeeting,
  ConjuntoReportNextContact,
  ConjuntoReportProcess,
  ConjuntoReportStage,
} from './conjunto-report.types';
import { FollowUpType, StageProgressStatus } from '../common/enums';
import {
  CalendarEventStatus,
  ClientProcessStatus,
  MeetingStatus,
} from '../common/enums';
import { isSeguimientoTemplate } from '../common/seguimiento-template';
import { Meeting } from '../entities/meeting.entity';
import { CalendarEvent } from '../entities/calendar-event.entity';

export interface AuthUserPayload {
  id: string;
  name: string;
  email: string;
}

/** Clientes mínimos para formularios del calendario (sin follow-ups ni historial). */
export interface CalendarClientOption {
  id: string;
  name: string;
  processes: { id: string; name: string }[];
}

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(ClientProcess)
    private readonly processRepo: Repository<ClientProcess>,
    @InjectRepository(FollowUp)
    private readonly followUpRepo: Repository<FollowUp>,
    @InjectRepository(Meeting)
    private readonly meetingRepo: Repository<Meeting>,
    @InjectRepository(CalendarEvent)
    private readonly eventRepo: Repository<CalendarEvent>,
    @InjectRepository(ClientUpdateLog)
    private readonly updateLogRepo: Repository<ClientUpdateLog>,
  ) {}

  /** Reuniones/entregas terminadas que cumplen un «próximo contacto» pendiente. */
  async getFulfilledDatesByClient(
    clientIds: string[],
  ): Promise<Map<string, Date[]>> {
    const map = new Map<string, Date[]>();
    if (!clientIds.length) return map;

    const push = (clientId: string, at: Date) => {
      const list = map.get(clientId) ?? [];
      list.push(at);
      map.set(clientId, list);
    };

    const meetings = await this.meetingRepo
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.stageProgress', 'sp')
      .innerJoinAndSelect('sp.clientProcess', 'cp')
      .where('cp.clientId IN (:...ids)', { ids: clientIds })
      .andWhere('m.status = :completed', { completed: MeetingStatus.COMPLETED })
      .getMany();

    for (const m of meetings) {
      push(m.stageProgress.clientProcess.clientId, m.scheduledAt);
    }

    const deliveries = await this.eventRepo.find({
      where: {
        clientId: In(clientIds),
        status: CalendarEventStatus.COMPLETED,
      },
      select: { clientId: true, dueAt: true },
    });
    for (const e of deliveries) {
      push(e.clientId, new Date(e.dueAt));
    }

    return map;
  }

  private attachFollowUpSummaryForClient<T extends { id: string; followUps?: FollowUp[] }>(
    client: T,
    fulfilledByClient: Map<string, Date[]>,
  ): T & { followUpSummary: FollowUpSummary } {
    return {
      ...client,
      followUpSummary: buildFollowUpSummary(
        client.followUps,
        fulfilledByClient.get(client.id) ?? [],
      ),
    };
  }

  private groupFollowUpsByClient(followUps: FollowUp[]) {
    const map = new Map<string, FollowUp[]>();
    for (const fu of followUps) {
      const list = map.get(fu.clientId) ?? [];
      list.push(fu);
      map.set(fu.clientId, list);
    }
    return map;
  }

  private clientHasTrackableProcess(client: {
    processes?: { status: string; processTemplate?: { name: string } }[];
  }) {
    return client.processes?.some(
      (p) =>
        (p.status === ClientProcessStatus.ACTIVE ||
          p.status === ClientProcessStatus.COMPLETED) &&
        !isSeguimientoTemplate(p.processTemplate),
    );
  }

  private withoutSeguimientoProcesses<T extends { processes?: { processTemplate?: { name: string } }[] }>(
    client: T,
  ): T {
    if (client.processes) {
      client.processes = client.processes.filter(
        (p) => !isSeguimientoTemplate(p.processTemplate),
      );
    }
    return client;
  }

  async findAll() {
    const [clients, followUps] = await Promise.all([
      this.clientRepo.find({
        relations: { processes: { processTemplate: true } },
        order: { createdAt: 'DESC' },
      }),
      this.followUpRepo.find({
        select: {
          id: true,
          clientId: true,
          occurredAt: true,
          nextActionAt: true,
        },
        order: { occurredAt: 'DESC' },
      }),
    ]);
    const followUpsByClient = this.groupFollowUpsByClient(followUps);
    const fulfilledByClient = await this.getFulfilledDatesByClient(
      clients.map((c) => c.id),
    );

    return clients.map((c) =>
      this.attachFollowUpSummaryForClient(
        {
          ...this.withoutSeguimientoProcesses(c),
          followUps: followUpsByClient.get(c.id) ?? [],
        },
        fulfilledByClient,
      ),
    );
  }

  async findForCalendar(): Promise<CalendarClientOption[]> {
    const clients = await this.clientRepo.find({
      relations: { processes: { processTemplate: true } },
      select: {
        id: true,
        name: true,
        processes: {
          id: true,
          processTemplate: { name: true },
        },
      },
      order: { name: 'ASC' },
    });

    return clients.map((c) => {
      const filtered = this.withoutSeguimientoProcesses(c);
      return {
        id: c.id,
        name: c.name,
        processes:
          filtered.processes?.map((p) => ({
            id: p.id,
            name: p.processTemplate?.name ?? 'Proceso',
          })) ?? [],
      };
    });
  }

  /** Clientes con mucho tiempo sin seguimiento o próximo contacto vencido. */
  async getFollowUpAlerts(staleDays = 30, limit = 15): Promise<FollowUpAlertRow[]> {
    const trackableRows = await this.processRepo
      .createQueryBuilder('cp')
      .innerJoin('cp.processTemplate', 'pt')
      .select('DISTINCT cp.clientId', 'clientId')
      .where('cp.status IN (:...statuses)', {
        statuses: [ClientProcessStatus.ACTIVE, ClientProcessStatus.COMPLETED],
      })
      .andWhere('LOWER(TRIM(pt.name)) != :seg', { seg: 'seguimiento' })
      .getRawMany<{ clientId: string }>();

    const clientIds = trackableRows.map((r) => r.clientId);
    if (!clientIds.length) return [];

    const [clients, followUps] = await Promise.all([
      this.clientRepo.find({
        where: { id: In(clientIds) },
        select: { id: true, name: true, company: true },
      }),
      this.followUpRepo.find({
        where: { clientId: In(clientIds) },
        select: {
          id: true,
          clientId: true,
          occurredAt: true,
          nextActionAt: true,
        },
        order: { occurredAt: 'DESC' },
      }),
    ]);
    const followUpsByClient = this.groupFollowUpsByClient(followUps);
    const fulfilledByClient = await this.getFulfilledDatesByClient(clientIds);

    const rows: FollowUpAlertRow[] = [];

    for (const client of clients) {
      const summary = buildFollowUpSummary(
        followUpsByClient.get(client.id) ?? [],
        fulfilledByClient.get(client.id) ?? [],
      );
      const stale =
        summary.daysSinceLastFollowUp === null ||
        summary.daysSinceLastFollowUp >= staleDays;
      const overdueNext = summary.nextActionOverdue;

      if (!stale && !overdueNext) continue;

      rows.push({
        clientId: client.id,
        clientName: client.name,
        company: client.company,
        daysSinceLastFollowUp: summary.daysSinceLastFollowUp,
        lastFollowUpAt: summary.lastFollowUpAt,
        nextActionAt: summary.nextActionAt,
        nextActionOverdue: summary.nextActionOverdue,
        totalFollowUps: summary.totalFollowUps,
      });
    }

    rows.sort((a, b) => {
      if (a.nextActionOverdue && !b.nextActionOverdue) return -1;
      if (!a.nextActionOverdue && b.nextActionOverdue) return 1;
      const da = a.daysSinceLastFollowUp ?? 99999;
      const db = b.daysSinceLastFollowUp ?? 99999;
      return db - da;
    });

    return rows.slice(0, limit);
  }

  async findOne(id: string) {
    const client = await this.clientRepo.findOne({
      where: { id },
      relations: {
        processes: {
          processTemplate: true,
          stageProgresses: { stageTemplate: true },
        },
        followUps: {
          clientProcess: { processTemplate: true },
        },
        updateLogs: true,
      },
    });
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }
    for (const proc of client.processes ?? []) {
      proc.stageProgresses?.sort(
        (a, b) => a.stageTemplate.orderIndex - b.stageTemplate.orderIndex,
      );
    }
    client.followUps?.sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
    client.updateLogs?.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const fulfilledByClient = await this.getFulfilledDatesByClient([client.id]);
    return this.attachFollowUpSummaryForClient(
      this.withoutSeguimientoProcesses(client),
      fulfilledByClient,
    );
  }

  create(dto: CreateClientDto) {
    const client = this.clientRepo.create({
      name: dto.name,
      contactName: dto.contactName ?? null,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      company: dto.company ?? null,
      notes: dto.notes ?? null,
    });
    return this.clientRepo.save(client);
  }

  async update(id: string, dto: UpdateClientDto, user?: AuthUserPayload) {
    const client = await this.clientRepo.findOne({ where: { id } });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    const changes: ClientFieldChange[] = [];

    const applyField = (
      field: (typeof CLIENT_EDITABLE_FIELDS)[number],
      newValue: string | null,
    ) => {
      const oldValue = client[field];
      if (formatClientFieldValue(oldValue) === formatClientFieldValue(newValue)) {
        return;
      }
      changes.push({
        field,
        label: CLIENT_FIELD_LABELS[field],
        oldValue: formatClientFieldValue(oldValue),
        newValue: formatClientFieldValue(newValue),
      });
      switch (field) {
        case 'name':
          client.name = newValue ?? client.name;
          break;
        case 'contactName':
          client.contactName = newValue;
          break;
        case 'email':
          client.email = newValue;
          break;
        case 'phone':
          client.phone = newValue;
          break;
        case 'company':
          client.company = newValue;
          break;
        case 'notes':
          client.notes = newValue;
          break;
      }
    };

    if (dto.name !== undefined) {
      applyField('name', dto.name.trim() || client.name);
    }
    if (dto.contactName !== undefined) {
      applyField('contactName', dto.contactName.trim() || null);
    }
    if (dto.email !== undefined) {
      applyField('email', dto.email.trim() || null);
    }
    if (dto.phone !== undefined) {
      applyField('phone', dto.phone.trim() || null);
    }
    if (dto.company !== undefined) {
      applyField('company', dto.company.trim() || null);
    }
    if (dto.notes !== undefined) {
      applyField('notes', dto.notes.trim() || null);
    }

    if (changes.length === 0) {
      return this.findOne(id);
    }

    await this.clientRepo.save(client);

    await this.updateLogRepo.save(
      this.updateLogRepo.create({
        clientId: id,
        updatedByUserId: user?.id ?? null,
        updatedByName: user?.name ?? 'Sistema',
        changes,
      }),
    );

    return this.findOne(id);
  }

  async getUpdateHistory(clientId: string) {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    return this.updateLogRepo.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async remove(id: string) {
    const client = await this.findOne(id);
    await this.clientRepo.remove(client);
    return { deleted: true };
  }

  private stageDurationLabel(stage: {
    durationDays?: number | null;
    minDurationDays?: number | null;
    maxDurationDays?: number | null;
    formDeadlineDays?: number | null;
  }): string {
    if (stage.formDeadlineDays) {
      return `${stage.formDeadlineDays} días calendario (formulario)`;
    }
    if (stage.durationDays) return `${stage.durationDays} días`;
    if (stage.minDurationDays && stage.maxDurationDays) {
      return `${stage.minDurationDays}–${stage.maxDurationDays} días`;
    }
    if (stage.minDurationDays) return `mín. ${stage.minDurationDays} días`;
    return 'Sin plazo definido';
  }

  private mapFollowUpRow(
    fu: FollowUp,
    stageName: string | null,
  ): ConjuntoReportFollowUp {
    return {
      id: fu.id,
      title: fu.title,
      description: fu.description,
      followUpType: fu.followUpType,
      occurredAt: new Date(fu.occurredAt).toISOString(),
      nextActionAt: fu.nextActionAt
        ? new Date(fu.nextActionAt).toISOString()
        : null,
      stageName,
    };
  }

  async findConjuntoPicker() {
    const rows = await this.clientRepo.find({
      select: { id: true, name: true, company: true },
      order: { name: 'ASC' },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      company: c.company,
    }));
  }

  async getConjuntoReport(clientId: string): Promise<ConjuntoReport> {
    const client = await this.clientRepo.findOne({
      where: { id: clientId },
      relations: {
        processes: {
          processTemplate: true,
          stageProgresses: { stageTemplate: true },
        },
        followUps: {
          clientProcess: { processTemplate: true },
        },
      },
    });
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const processes = (client.processes ?? []).filter(
      (p) => !isSeguimientoTemplate(p.processTemplate),
    );
    for (const proc of processes) {
      proc.stageProgresses?.sort(
        (a, b) => a.stageTemplate.orderIndex - b.stageTemplate.orderIndex,
      );
    }

    const followUps = [...(client.followUps ?? [])].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );

    const fulfilledByClient = await this.getFulfilledDatesByClient([clientId]);
    const fulfilled = fulfilledByClient.get(clientId) ?? [];
    const followUpSummary = buildFollowUpSummary(followUps, fulfilled);
    const now = new Date();

    const stageNameForFollowUp = (fu: FollowUp): string | null => {
      if (!fu.clientProcessId) return null;
      const proc = processes.find((p) => p.id === fu.clientProcessId);
      if (!proc) return fu.clientProcess?.processTemplate?.name ?? null;
      const current = proc.currentStageProgressId
        ? proc.stageProgresses?.find((sp) => sp.id === proc.currentStageProgressId)
        : proc.stageProgresses?.find(
            (sp) => sp.status === StageProgressStatus.IN_PROGRESS,
          );
      return current?.stageTemplate?.name ?? proc.processTemplate?.name ?? null;
    };

    const lastFollowUp = followUps[0]
      ? this.mapFollowUpRow(followUps[0], stageNameForFollowUp(followUps[0]))
      : null;

    const recentFollowUps = followUps
      .slice(0, 8)
      .map((fu) => this.mapFollowUpRow(fu, stageNameForFollowUp(fu)));

    const pendingNextContacts: ConjuntoReportNextContact[] = [];
    for (const fu of followUps) {
      if (!fu.nextActionAt) continue;
      const nextAt = new Date(fu.nextActionAt);
      if (isNextActionFulfilled(nextAt, followUps, fulfilled)) continue;
      pendingNextContacts.push({
        followUpId: fu.id,
        title: fu.title,
        at: nextAt.toISOString(),
        overdue: nextAt.getTime() < now.getTime(),
      });
    }
    pendingNextContacts.sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
    );

    const reportProcess =
      processes.find((p) => p.status === ClientProcessStatus.ACTIVE) ??
      processes.find((p) => p.status === ClientProcessStatus.COMPLETED) ??
      null;

    let process: ConjuntoReportProcess | null = null;
    if (reportProcess) {
      const currentId = reportProcess.currentStageProgressId;
      const stages: ConjuntoReportStage[] = (reportProcess.stageProgresses ?? []).map(
        (sp) => {
          const due = sp.dueDate ? new Date(sp.dueDate) : null;
          const overdue =
            !!due &&
            due.getTime() < now.getTime() &&
            sp.status !== StageProgressStatus.COMPLETED &&
            sp.status !== StageProgressStatus.SKIPPED;
          return {
            id: sp.id,
            orderIndex: sp.stageTemplate.orderIndex,
            name: sp.stageTemplate.name,
            stageType: sp.stageTemplate.stageType,
            status: sp.status,
            startedAt: sp.startedAt ? new Date(sp.startedAt).toISOString() : null,
            dueDate: sp.dueDate ? new Date(sp.dueDate).toISOString() : null,
            completedAt: sp.completedAt
              ? new Date(sp.completedAt).toISOString()
              : null,
            overdue,
            durationLabel: this.stageDurationLabel(sp.stageTemplate),
            isCurrent:
              sp.id === currentId ||
              (sp.status === StageProgressStatus.IN_PROGRESS && !currentId),
          };
        },
      );
      const currentStage = stages.find((s) => s.isCurrent) ?? null;
      process = {
        id: reportProcess.id,
        templateName: reportProcess.processTemplate?.name ?? 'Proceso',
        status: reportProcess.status,
        startedAt: reportProcess.startedAt
          ? new Date(reportProcess.startedAt).toISOString()
          : null,
        completedAt: reportProcess.completedAt
          ? new Date(reportProcess.completedAt).toISOString()
          : null,
        currentStageName: currentStage?.name ?? null,
        stages,
      };
    }

    const processIds = processes.map((p) => p.id);
    const plannedMeetings: ConjuntoReportMeeting[] = [];

    if (processIds.length) {
      const stageMeetings = await this.meetingRepo
        .createQueryBuilder('m')
        .innerJoinAndSelect('m.stageProgress', 'sp')
        .innerJoinAndSelect('sp.stageTemplate', 'st')
        .innerJoin('sp.clientProcess', 'cp')
        .where('cp.id IN (:...ids)', { ids: processIds })
        .andWhere('m.status = :scheduled', { scheduled: MeetingStatus.SCHEDULED })
        .orderBy('m.scheduledAt', 'ASC')
        .getMany();

      for (const m of stageMeetings) {
        plannedMeetings.push({
          id: m.id,
          title: m.title,
          scheduledAt: new Date(m.scheduledAt).toISOString(),
          status: m.status,
          stageName: m.stageProgress?.stageTemplate?.name ?? null,
          source: 'stage',
        });
      }
    }

    const futureFollowUpMeetings = followUps.filter(
      (fu) =>
        fu.followUpType === FollowUpType.MEETING &&
        new Date(fu.occurredAt).getTime() >= now.getTime(),
    );
    for (const fu of futureFollowUpMeetings) {
      plannedMeetings.push({
        id: fu.id,
        title: fu.title,
        scheduledAt: new Date(fu.occurredAt).toISOString(),
        status: 'scheduled',
        stageName: stageNameForFollowUp(fu),
        source: 'followup',
      });
    }
    plannedMeetings.sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );

    const calendarRows = await this.eventRepo.find({
      where: { clientId },
      order: { dueAt: 'ASC' },
    });

    const deliveries: ConjuntoReportDelivery[] = calendarRows
      .filter((e) => e.status !== CalendarEventStatus.CANCELLED)
      .map((e) => {
        const due = new Date(e.dueAt);
        const overdue =
          e.status === CalendarEventStatus.ACTIVE && due.getTime() < now.getTime();
        return {
          id: e.id,
          title: e.title,
          dueAt: due.toISOString(),
          status: e.status,
          eventType: e.eventType as 'client_delivery' | 'internal_delivery',
          description: e.description,
          overdue,
        };
      });

    return {
      client: {
        id: client.id,
        name: client.name,
        company: client.company,
        contactName: client.contactName,
        phone: client.phone,
        email: client.email,
      },
      followUpSummary,
      lastFollowUp,
      recentFollowUps,
      pendingNextContacts,
      process,
      plannedMeetings,
      deliveries,
    };
  }
}
