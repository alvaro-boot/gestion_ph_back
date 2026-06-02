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
  MeetingStatus,
  StageProgressStatus,
} from '../common/enums';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { CreateCalendarMeetingDto } from './dto/create-calendar-meeting.dto';
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
    private readonly meetingsService: MeetingsService,
    private readonly clientsService: ClientsService,
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

    const [meetings, deliveries] = await Promise.all([
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
        };
      }),
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

    if (dto.title !== undefined) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description ?? null;
    if (dto.dueAt !== undefined) event.dueAt = new Date(dto.dueAt);
    if (dto.status !== undefined) event.status = dto.status;

    return this.eventRepo.save(event);
  }

  async removeDelivery(id: string) {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Entrega no encontrada');
    await this.eventRepo.remove(event);
    return { deleted: true };
  }

  async createMeeting(dto: CreateCalendarMeetingDto) {
    return this.meetingsService.create({
      stageProgressId: dto.stageProgressId,
      title: dto.title,
      scheduledAt: dto.scheduledAt,
      location: dto.location,
      notes: dto.notes,
    });
  }

  async cancelMeeting(id: string) {
    return this.meetingsService.updateStatus(id, MeetingStatus.CANCELLED);
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
      return {
        processId: p.id,
        clientId: p.clientId,
        clientName: p.client?.name ?? '—',
        templateName: p.processTemplate?.name ?? 'Proceso',
        processKind: 'onboarding' as const,
        currentStageProgressId: sp?.id ?? null,
        currentStageName: sp?.stageTemplate?.name ?? null,
      };
    });
  }
}
