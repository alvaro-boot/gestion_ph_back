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
import { SeguimientoProcessService } from '../client-processes/seguimiento-process.service';
import { ProcessTemplate } from '../entities/process-template.entity';

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
    private readonly seguimientoProcess: SeguimientoProcessService,
  ) {}

  private mapProcessToPickerOption(
    p: ClientProcess,
    processKind: 'onboarding' | 'seguimiento',
  ): CalendarPickerOption {
    p.stageProgresses?.sort(
      (a, b) => a.stageTemplate.orderIndex - b.stageTemplate.orderIndex,
    );
    const current = p.stageProgresses?.find(
      (sp) => sp.status === StageProgressStatus.IN_PROGRESS,
    );
    return {
      processId: p.id,
      clientId: p.clientId,
      clientName: p.client?.name ?? '—',
      templateName: p.processTemplate?.name ?? 'Proceso',
      processKind,
      currentStageProgressId:
        current?.id ?? p.stageProgresses?.[0]?.id ?? null,
      currentStageName: current?.stageTemplate?.name ?? null,
    };
  }

  async getMonth(year: number, month: number) {
    if (month < 1 || month > 12) {
      throw new BadRequestException('Mes inválido (1-12)');
    }
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const meetings = await this.meetingRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.stageProgress', 'sp')
      .leftJoinAndSelect('sp.clientProcess', 'cp')
      .leftJoinAndSelect('cp.client', 'client')
      .leftJoinAndSelect('cp.processTemplate', 'processTemplate')
      .where('m.scheduledAt >= :start', { start })
      .andWhere('m.scheduledAt <= :end', { end })
      .andWhere('m.status != :cancelled', {
        cancelled: MeetingStatus.CANCELLED,
      })
      .orderBy('m.scheduledAt', 'ASC')
      .getMany();

    const deliveries = await this.eventRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.client', 'client')
      .leftJoinAndSelect('e.clientProcess', 'cp')
      .where('e.dueAt >= :start', { start })
      .andWhere('e.dueAt <= :end', { end })
      .andWhere('e.status != :cancelled', {
        cancelled: CalendarEventStatus.CANCELLED,
      })
      .orderBy('e.dueAt', 'ASC')
      .getMany();

    const items: CalendarMonthItem[] = [
      ...meetings.map((m) => {
        const template = m.stageProgress?.clientProcess?.processTemplate;
        const processKind =
          template &&
          this.seguimientoProcess.isSeguimientoTemplate(template as ProcessTemplate)
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

  /** Procesos activos (onboarding + seguimiento) para agendar reuniones. */
  async getPickerOptions(): Promise<CalendarPickerOption[]> {
    const processes = await this.processRepo.find({
      where: { status: ClientProcessStatus.ACTIVE },
      relations: {
        client: true,
        processTemplate: true,
        stageProgresses: { stageTemplate: true },
      },
    });

    const options: CalendarPickerOption[] = processes.map((p) =>
      this.mapProcessToPickerOption(
        p,
        this.seguimientoProcess.isSeguimientoTemplate(p.processTemplate)
          ? 'seguimiento'
          : 'onboarding',
      ),
    );

    const onboardingCompleted = await this.processRepo
      .createQueryBuilder('cp')
      .innerJoin('cp.processTemplate', 'pt')
      .where('cp.status = :completed', {
        completed: ClientProcessStatus.COMPLETED,
      })
      .andWhere('LOWER(pt.name) != :seg', { seg: 'seguimiento' })
      .select('DISTINCT cp.clientId', 'clientId')
      .getRawMany<{ clientId: string }>();

    for (const row of onboardingCompleted) {
      const hasSeguimiento = options.some(
        (o) => o.clientId === row.clientId && o.processKind === 'seguimiento',
      );
      if (hasSeguimiento) continue;
      try {
        const proc = await this.seguimientoProcess.ensureProcess(row.clientId);
        options.push(this.mapProcessToPickerOption(proc, 'seguimiento'));
      } catch {
        /* plantilla seguimiento no lista o cliente sin onboarding */
      }
    }

    return options.sort((a, b) =>
      a.clientName.localeCompare(b.clientName, 'es'),
    );
  }
}
