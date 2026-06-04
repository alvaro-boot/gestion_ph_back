import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarEvent } from '../entities/calendar-event.entity';
import { Meeting } from '../entities/meeting.entity';
import { Client } from '../entities/client.entity';
import { ClientProcess } from '../entities/client-process.entity';
import { StageProgress } from '../entities/stage-progress.entity';
import {
  CalendarEventStatus,
  CalendarEventType,
  ClientProcessStatus,
  FollowUpType,
  MeetingStatus,
  StageProgressStatus,
} from '../common/enums';
import { FollowUp } from '../entities/follow-up.entity';
import { SeguimientosService } from '../seguimientos/seguimientos.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { CreateCalendarMeetingDto } from './dto/create-calendar-meeting.dto';
import { UpdateMeetingDto } from '../meetings/dto/update-meeting.dto';
import { MeetingsService } from '../meetings/meetings.service';
import { isSeguimientoTemplate } from '../common/seguimiento-template';
import { ProcessTemplate } from '../entities/process-template.entity';
import { ClientsService } from '../clients/clients.service';
import { In } from 'typeorm';
import { isNextActionFulfilled } from '../common/follow-up-summary';

export type CalendarItemKind =
  | 'meeting'
  | 'client_delivery'
  | 'internal_delivery'
  | 'next_contact';

export interface CalendarMonthItem {
  id: string;
  kind: CalendarItemKind;
  title: string;
  at: string;
  status: string;
  clientId: string;
  clientName: string;
  processId: string | null;
  stageProgressId?: string | null;
  description?: string | null;
  processKind?: 'onboarding' | 'seguimiento';
  /** Reunión ligada a etapa de onboarding vs. bitácora post-onboarding */
  meetingSource?: 'stage' | 'followup';
  notes?: string | null;
  completionNotes?: string | null;
  /** Fecha original del compromiso (próximo contacto), si se muestra al inicio del mes por vencido */
  scheduledAt?: string | null;
}

export interface CalendarPickerOption {
  processId: string;
  clientId: string;
  clientName: string;
  templateName: string;
  processKind: 'onboarding' | 'seguimiento';
  currentStageProgressId: string | null;
  currentStageName: string | null;
}

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(CalendarEvent)
    private readonly eventRepo: Repository<CalendarEvent>,
    @InjectRepository(Meeting)
    private readonly meetingRepo: Repository<Meeting>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(ClientProcess)
    private readonly processRepo: Repository<ClientProcess>,
    @InjectRepository(StageProgress)
    private readonly progressRepo: Repository<StageProgress>,
    @InjectRepository(FollowUp)
    private readonly followUpRepo: Repository<FollowUp>,
    private readonly meetingsService: MeetingsService,
    private readonly clientsService: ClientsService,
    private readonly seguimientosService: SeguimientosService,
  ) {}

  async getBootstrap(year: number, month: number) {
    const [items, pickerOptions, clients] = await Promise.all([
      this.getMonth(year, month),
      this.getPickerOptions(),
      this.clientsService.findForCalendar(),
    ]);
    return { items, pickerOptions, clients };
  }

  async getMonth(year: number, month: number) {
    if (month < 1 || month > 12) {
      throw new BadRequestException('Mes inválido (1-12)');
    }
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const [meetings, followUpMeetings, deliveries, nextContacts] =
      await Promise.all([
      this.meetingRepo
        .createQueryBuilder('m')
        .innerJoinAndSelect('m.stageProgress', 'sp')
        .innerJoinAndSelect('sp.clientProcess', 'cp')
        .innerJoinAndSelect('cp.client', 'client')
        .innerJoinAndSelect('cp.processTemplate', 'processTemplate')
        .where('m.scheduledAt >= :start', { start })
        .andWhere('m.scheduledAt <= :end', { end })
        .andWhere('m.status != :cancelled', {
          cancelled: MeetingStatus.CANCELLED,
        })
        .orderBy('m.scheduledAt', 'ASC')
        .getMany(),
      this.followUpRepo
        .createQueryBuilder('fu')
        .innerJoinAndSelect('fu.client', 'client')
        .leftJoinAndSelect('fu.clientProcess', 'cp')
        .where('fu.followUpType = :meetingType', {
          meetingType: FollowUpType.MEETING,
        })
        .andWhere('fu.occurredAt >= :start', { start })
        .andWhere('fu.occurredAt <= :end', { end })
        .orderBy('fu.occurredAt', 'ASC')
        .getMany(),
      this.eventRepo
        .createQueryBuilder('e')
        .innerJoinAndSelect('e.client', 'client')
        .where('e.dueAt >= :start', { start })
        .andWhere('e.dueAt <= :end', { end })
        .andWhere('e.status != :cancelled', {
          cancelled: CalendarEventStatus.CANCELLED,
        })
        .orderBy('e.dueAt', 'ASC')
        .getMany(),
      this.loadNextContactItems(start, end),
    ]);

    const items: CalendarMonthItem[] = [
      ...meetings.map((m) => {
        const template = m.stageProgress?.clientProcess?.processTemplate;
        const processKind =
          template && isSeguimientoTemplate(template as ProcessTemplate)
            ? ('seguimiento' as const)
            : ('onboarding' as const);
        return {
          id: m.id,
          kind: 'meeting' as const,
          title: m.title,
          at: m.scheduledAt.toISOString(),
          status: m.status,
          clientId: m.stageProgress?.clientProcess?.clientId ?? '',
          clientName: m.stageProgress?.clientProcess?.client?.name ?? '—',
          processId: m.stageProgress?.clientProcess?.id ?? null,
          stageProgressId: m.stageProgressId,
          processKind,
          meetingSource: 'stage' as const,
          notes: m.notes,
        };
      }),
      ...followUpMeetings.map((fu) => ({
        id: fu.id,
        kind: 'meeting' as const,
        title: fu.title,
        at: fu.occurredAt.toISOString(),
        status: fu.description?.includes('[Realizada]')
          ? 'completed'
          : 'scheduled',
        clientId: fu.clientId,
        clientName: fu.client?.name ?? '—',
        processId: fu.clientProcessId,
        processKind: 'seguimiento' as const,
        meetingSource: 'followup' as const,
        description: fu.description,
      })),
      ...deliveries.map((e) => ({
        id: e.id,
        kind:
          e.eventType === CalendarEventType.CLIENT_DELIVERY
            ? ('client_delivery' as const)
            : ('internal_delivery' as const),
        title: e.title,
        at: e.dueAt.toISOString(),
        status: e.status,
        clientId: e.clientId,
        clientName: e.client?.name ?? '—',
        processId: e.clientProcessId,
        description: e.description,
        completionNotes: e.completionNotes,
      })),
      ...nextContacts,
    ];

    items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return items;
  }

  /** Próximo contacto del conjunto (nivel cliente) en el calendario. */
  private async loadNextContactItems(
    start: Date,
    end: Date,
  ): Promise<CalendarMonthItem[]> {
    const clients = await this.clientRepo
      .createQueryBuilder('c')
      .where('c.nextContactAt IS NOT NULL')
      .andWhere('c.nextContactAt <= :end', { end })
      .getMany();

    if (!clients.length) return [];

    const clientIds = clients.map((c) => c.id);
    const [allFollowUps, fulfilledByClient] = await Promise.all([
      this.followUpRepo.find({ where: { clientId: In(clientIds) } }),
      this.clientsService.getFulfilledDatesByClient(clientIds),
    ]);

    const followUpsByClient = new Map<string, FollowUp[]>();
    for (const fu of allFollowUps) {
      const list = followUpsByClient.get(fu.clientId) ?? [];
      list.push(fu);
      followUpsByClient.set(fu.clientId, list);
    }

    const now = new Date();
    const items: CalendarMonthItem[] = [];

    for (const client of clients) {
      const nextAt = new Date(client.nextContactAt!);
      const clientFollowUps = followUpsByClient.get(client.id) ?? [];
      const fulfilled = fulfilledByClient.get(client.id) ?? [];

      const done = isNextActionFulfilled(nextAt, clientFollowUps, fulfilled);

      const overdue = !done && nextAt.getTime() < now.getTime();
      const displayAt =
        nextAt.getTime() < start.getTime()
          ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), 9, 0, 0, 0)
          : nextAt;

      if (nextAt.getTime() > end.getTime()) continue;

      items.push({
        id: client.id,
        kind: 'next_contact',
        title: client.nextContactTitle?.trim() || 'Próximo contacto',
        at: displayAt.toISOString(),
        scheduledAt: nextAt.toISOString(),
        status: done ? 'completed' : overdue ? 'overdue' : 'pending',
        clientId: client.id,
        clientName: client.name,
        processId: null,
        description: null,
      });
    }

    return items;
  }

  async createDelivery(dto: CreateCalendarEventDto) {
    const client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    if (dto.clientProcessId) {
      const proc = await this.processRepo.findOne({
        where: { id: dto.clientProcessId, clientId: dto.clientId },
      });
      if (!proc) {
        throw new NotFoundException('Proceso del cliente no encontrado');
      }
    }

    const entity = this.eventRepo.create({
      clientId: dto.clientId,
      clientProcessId: dto.clientProcessId ?? null,
      eventType: dto.eventType,
      title: dto.title,
      description: dto.description ?? null,
      dueAt: new Date(dto.dueAt),
      status: CalendarEventStatus.ACTIVE,
    });
    return this.eventRepo.save(entity);
  }

  async updateDelivery(id: string, dto: UpdateCalendarEventDto) {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Entrega no encontrada');

    if (event.status === CalendarEventStatus.CANCELLED) {
      throw new BadRequestException('Esta entrega ya fue cancelada.');
    }
    if (
      event.status === CalendarEventStatus.COMPLETED &&
      dto.status !== CalendarEventStatus.CANCELLED
    ) {
      throw new BadRequestException('Esta entrega ya fue terminada.');
    }

    if (dto.title !== undefined) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description ?? null;
    if (dto.dueAt !== undefined) event.dueAt = new Date(dto.dueAt);
    if (dto.completionNotes !== undefined) {
      event.completionNotes = dto.completionNotes ?? null;
    }
    if (dto.status !== undefined) {
      if (
        dto.status === CalendarEventStatus.COMPLETED &&
        !dto.completionNotes?.trim()
      ) {
        throw new BadRequestException(
          'Indica notas al marcar la entrega como terminada.',
        );
      }
      event.status = dto.status;
    }

    return this.eventRepo.save(event);
  }

  async removeDelivery(id: string) {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Entrega no encontrada');
    await this.eventRepo.remove(event);
    return { deleted: true };
  }

  async createMeeting(dto: CreateCalendarMeetingDto) {
    const process = await this.processRepo.findOne({
      where: { id: dto.processId },
      relations: {
        client: true,
        processTemplate: true,
        stageProgresses: { stageTemplate: true },
      },
    });
    if (!process) {
      throw new NotFoundException('Proceso del cliente no encontrado');
    }
    if (isSeguimientoTemplate(process.processTemplate)) {
      throw new BadRequestException(
        'Selecciona el proceso de onboarding del cliente, no la plantilla «Seguimiento».',
      );
    }

    const scheduledAt = new Date(dto.scheduledAt);

    if (process.status === ClientProcessStatus.ACTIVE) {
      let stageId = dto.stageProgressId;
      if (stageId) {
        const belongs = process.stageProgresses?.some((sp) => sp.id === stageId);
        if (!belongs) {
          throw new BadRequestException('La etapa no pertenece a este proceso.');
        }
      } else {
        const current = process.stageProgresses?.find(
          (sp) => sp.status === StageProgressStatus.IN_PROGRESS,
        );
        if (!current) {
          throw new BadRequestException(
            'No hay etapa en curso en este proceso de onboarding.',
          );
        }
        stageId = current.id;
      }

      const meeting = await this.meetingsService.create({
        stageProgressId: stageId!,
        title: dto.title,
        scheduledAt: dto.scheduledAt,
        location: dto.location,
        notes: dto.notes,
      });

      return { meetingSource: 'stage' as const, meeting };
    }

    if (process.status === ClientProcessStatus.COMPLETED) {
      const followUp = await this.seguimientosService.create({
        clientId: process.clientId,
        clientProcessId: process.id,
        title: dto.title,
        description: dto.notes ?? undefined,
        followUpType: FollowUpType.MEETING,
        occurredAt: dto.scheduledAt,
      });

      return { meetingSource: 'followup' as const, followUp };
    }

    throw new BadRequestException(
      'Solo puedes agendar reuniones en procesos de onboarding activos o completados.',
    );
  }

  async cancelMeeting(id: string) {
    return this.meetingsService.updateStatus(id, MeetingStatus.CANCELLED);
  }

  updateMeeting(id: string, dto: UpdateMeetingDto) {
    return this.meetingsService.update(id, dto);
  }

  /** Procesos de onboarding (activos o completados) para agendar reuniones. */
  async getPickerOptions(): Promise<CalendarPickerOption[]> {
    const processes = await this.processRepo
      .createQueryBuilder('cp')
      .innerJoinAndSelect('cp.client', 'client')
      .innerJoinAndSelect('cp.processTemplate', 'pt')
      .where('cp.status IN (:...statuses)', {
        statuses: [ClientProcessStatus.ACTIVE, ClientProcessStatus.COMPLETED],
      })
      .andWhere('LOWER(TRIM(pt.name)) != :seg', {
        seg: 'seguimiento',
      })
      .orderBy('client.name', 'ASC')
      .getMany();

    if (!processes.length) return [];

    const processIds = processes.map((p) => p.id);

    const inProgressStages = await this.progressRepo.find({
      where: {
        clientProcessId: In(processIds),
        status: StageProgressStatus.IN_PROGRESS,
      },
      relations: { stageTemplate: true },
    });
    const stageByProcess = new Map(
      inProgressStages.map((sp) => [sp.clientProcessId, sp]),
    );

    const missingIds = processIds.filter((id) => !stageByProcess.has(id));
    if (missingIds.length > 0) {
      const fallbackStages = await this.progressRepo
        .createQueryBuilder('sp')
        .innerJoinAndSelect('sp.stageTemplate', 'st')
        .where('sp.clientProcessId IN (:...ids)', { ids: missingIds })
        .orderBy('st.orderIndex', 'DESC')
        .getMany();
      for (const sp of fallbackStages) {
        if (!stageByProcess.has(sp.clientProcessId)) {
          stageByProcess.set(sp.clientProcessId, sp);
        }
      }
    }

    return processes.map((p) => {
      const sp = stageByProcess.get(p.id);
      const isActive = p.status === ClientProcessStatus.ACTIVE;
      return {
        processId: p.id,
        clientId: p.clientId,
        clientName: p.client?.name ?? '—',
        templateName: p.processTemplate?.name ?? 'Proceso',
        processKind: isActive ? ('onboarding' as const) : ('seguimiento' as const),
        currentStageProgressId: isActive ? (sp?.id ?? null) : null,
        currentStageName: isActive ? (sp?.stageTemplate?.name ?? null) : null,
      };
    });
  }
}
