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

export type CalendarItemKind = 'meeting' | 'client_delivery' | 'internal_delivery';

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

    const [meetings, followUpMeetings, deliveries] = await Promise.all([
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
        status: 'scheduled',
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
    ];

    items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
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

    const saved = await this.eventRepo.save(event);

    if (saved.status === CalendarEventStatus.COMPLETED) {
      await this.clearFulfilledNextActions(saved.clientId, saved.dueAt);
    }

    return saved;
  }

  private async clearFulfilledNextActions(clientId: string, fulfilledAt: Date) {
    const followUps = await this.followUpRepo.find({ where: { clientId } });
    for (const fu of followUps) {
      if (
        fu.nextActionAt &&
        new Date(fu.nextActionAt).getTime() <= fulfilledAt.getTime()
      ) {
        fu.nextActionAt = null;
        await this.followUpRepo.save(fu);
      }
    }
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
