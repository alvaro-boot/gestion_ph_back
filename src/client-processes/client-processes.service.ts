import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProcess } from '../entities/client-process.entity';
import { StageProgress } from '../entities/stage-progress.entity';
import { ProcessTemplate } from '../entities/process-template.entity';
import { StageTemplate } from '../entities/stage-template.entity';
import { Client } from '../entities/client.entity';
import { StartProcessDto } from './dto/start-process.dto';
import { UpdateStageProgressDto } from './dto/update-stage-progress.dto';
import { AdvanceStageDto } from './dto/advance-stage.dto';
import { SetCurrentStageDto } from './dto/set-current-stage.dto';
import {
  ClientProcessStatus,
  MeetingStatus,
  StageProgressStatus,
} from '../common/enums';
import { computeStageDueDate } from '../common/date.utils';
import { Meeting } from '../entities/meeting.entity';
import { ClientsService } from '../clients/clients.service';
import { CalendarService } from '../calendar/calendar.service';
import { isSeguimientoTemplate } from '../common/seguimiento-template';

@Injectable()
export class ClientProcessesService {
  constructor(
    @InjectRepository(ClientProcess)
    private readonly processRepo: Repository<ClientProcess>,
    @InjectRepository(StageProgress)
    private readonly progressRepo: Repository<StageProgress>,
    @InjectRepository(ProcessTemplate)
    private readonly templateRepo: Repository<ProcessTemplate>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Meeting)
    private readonly meetingRepo: Repository<Meeting>,
    private readonly clientsService: ClientsService,
    private readonly calendarService: CalendarService,
  ) {}

  findAll() {
    return this.processRepo.find({
      relations: {
        client: true,
        processTemplate: true,
        stageProgresses: { stageTemplate: true },
      },
      order: { startedAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const proc = await this.processRepo.findOne({
      where: { id },
      relations: {
        client: true,
        processTemplate: true,
        stageProgresses: {
          stageTemplate: true,
          meetings: true,
          tasks: true,
        },
      },
    });
    if (!proc) {
      throw new NotFoundException('Proceso de cliente no encontrado');
    }
    proc.stageProgresses.sort(
      (a, b) => a.stageTemplate.orderIndex - b.stageTemplate.orderIndex,
    );
    return proc;
  }

  async start(dto: StartProcessDto) {
    const client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    const template = await this.templateRepo.findOne({
      where: { id: dto.processTemplateId },
      relations: { stages: true },
    });
    if (!template) {
      throw new NotFoundException('Plantilla de proceso no encontrada');
    }
    if (isSeguimientoTemplate(template)) {
      throw new BadRequestException(
        'El seguimiento del cliente se registra en la ficha (llamadas, visitas y notas), no como un proceso aparte.',
      );
    }
    if (!template.stages?.length) {
      throw new BadRequestException('La plantilla no tiene etapas definidas');
    }

    const sortedStages = [...template.stages].sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
    const currentIndex = (dto.currentStageNumber ?? 1) - 1;
    if (currentIndex < 0 || currentIndex >= sortedStages.length) {
      throw new BadRequestException('Número de etapa inválido para esta plantilla');
    }

    const processStart = dto.startedAt ? new Date(dto.startedAt) : null;
    const clientProcess = this.processRepo.create({
      clientId: dto.clientId,
      processTemplateId: dto.processTemplateId,
      status: ClientProcessStatus.ACTIVE,
      startedAt: processStart,
    });
    const savedProcess = await this.processRepo.save(clientProcess);

    const progresses = sortedStages.map((stage, index) =>
      this.buildStageProgress(savedProcess.id, stage, index, currentIndex, processStart),
    );

    const savedProgresses = await this.progressRepo.save(progresses);
    const current = savedProgresses[currentIndex];
    savedProcess.currentStageProgressId = current.id;
    await this.processRepo.save(savedProcess);

    return this.findOne(savedProcess.id);
  }

  async setCurrentStage(processId: string, dto: SetCurrentStageDto) {
    const proc = await this.findOne(processId);
    if (proc.status !== ClientProcessStatus.ACTIVE) {
      throw new BadRequestException('Solo se puede ajustar un proceso activo');
    }

    const currentIndex = dto.stageNumber - 1;
    if (currentIndex < 0 || currentIndex >= proc.stageProgresses.length) {
      throw new BadRequestException('Número de etapa inválido');
    }

    for (let i = 0; i < proc.stageProgresses.length; i++) {
      const sp = proc.stageProgresses[i];
      if (i < currentIndex) {
        sp.status = StageProgressStatus.COMPLETED;
        sp.startedAt = sp.startedAt ?? null;
        sp.completedAt = sp.completedAt ?? null;
        sp.dueDate = sp.dueDate ?? null;
      } else if (i === currentIndex) {
        sp.status = StageProgressStatus.IN_PROGRESS;
        sp.completedAt = null;
        if (!sp.startedAt) {
          sp.dueDate = null;
        }
      } else {
        sp.status = StageProgressStatus.PENDING;
        sp.startedAt = null;
        sp.completedAt = null;
        sp.dueDate = null;
      }
      await this.progressRepo.save(sp);
    }

    proc.currentStageProgressId = proc.stageProgresses[currentIndex].id;
    await this.processRepo.save(proc);
    return this.findOne(processId);
  }

  private buildStageProgress(
    clientProcessId: string,
    stage: StageTemplate,
    index: number,
    currentIndex: number,
    processStart: Date | null,
  ) {
    if (index < currentIndex) {
      return this.progressRepo.create({
        clientProcessId,
        stageTemplateId: stage.id,
        status: StageProgressStatus.COMPLETED,
        startedAt: null,
        dueDate: null,
        completedAt: null,
      });
    }
    if (index === currentIndex) {
      const startedAt =
        index === 0 && processStart ? processStart : null;
      const dueDate =
        startedAt ? computeStageDueDate(startedAt, stage) : null;
      return this.progressRepo.create({
        clientProcessId,
        stageTemplateId: stage.id,
        status: StageProgressStatus.IN_PROGRESS,
        startedAt,
        dueDate,
      });
    }
    return this.progressRepo.create({
      clientProcessId,
      stageTemplateId: stage.id,
      status: StageProgressStatus.PENDING,
      startedAt: null,
      dueDate: null,
      completedAt: null,
    });
  }

  async updateStageProgress(id: string, dto: UpdateStageProgressDto) {
    const progress = await this.progressRepo.findOne({
      where: { id },
      relations: { stageTemplate: true, clientProcess: true },
    });
    if (!progress) {
      throw new NotFoundException('Etapa no encontrada');
    }

    if (dto.notes !== undefined) progress.notes = dto.notes;

    if (dto.startedAt !== undefined) {
      progress.startedAt = new Date(dto.startedAt);
      if (dto.dueDate === undefined && progress.stageTemplate) {
        progress.dueDate = computeStageDueDate(
          progress.startedAt,
          progress.stageTemplate,
        );
      }
    }
    if (dto.dueDate !== undefined) {
      progress.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.completedAt !== undefined) {
      progress.completedAt = dto.completedAt ? new Date(dto.completedAt) : null;
    }

    if (dto.status) {
      progress.status = dto.status;
      if (
        dto.status === StageProgressStatus.IN_PROGRESS &&
        dto.startedAt !== undefined
      ) {
        progress.startedAt = dto.startedAt ? new Date(dto.startedAt) : null;
        if (dto.dueDate === undefined && progress.startedAt) {
          progress.dueDate = computeStageDueDate(
            progress.startedAt,
            progress.stageTemplate,
          );
        }
      }
      if (dto.status === StageProgressStatus.COMPLETED) {
        if (dto.completedAt !== undefined) {
          progress.completedAt = dto.completedAt
            ? new Date(dto.completedAt)
            : null;
        } else if (!progress.completedAt) {
          progress.completedAt = null;
        }
        await this.progressRepo.save(progress);
        await this.advanceToNext(progress);
        return this.findOne(progress.clientProcessId);
      }
    }

    await this.progressRepo.save(progress);
    return this.findOne(progress.clientProcessId);
  }

  async advanceStage(progressId: string, dto: AdvanceStageDto = {}) {
    const progress = await this.progressRepo.findOne({
      where: { id: progressId },
      relations: { stageTemplate: true, clientProcess: true },
    });
    if (!progress) throw new NotFoundException('Etapa no encontrada');

    progress.status = StageProgressStatus.COMPLETED;
    progress.completedAt = dto.completedAt
      ? new Date(dto.completedAt)
      : null;
    await this.progressRepo.save(progress);
    return this.advanceToNext(progress, dto.nextStartedAt);
  }

  private async advanceToNext(
    completed: StageProgress,
    nextStartedAtIso?: string,
  ) {
    const proc = await this.findOne(completed.clientProcessId);
    const currentIndex = proc.stageProgresses.findIndex(
      (p) => p.id === completed.id,
    );
    const next = proc.stageProgresses[currentIndex + 1];

    if (!next) {
      proc.status = ClientProcessStatus.COMPLETED;
      proc.completedAt = completed.completedAt;
      proc.currentStageProgressId = null;
      await this.processRepo.save(proc);
      return this.findOne(proc.id);
    }

    let nextStart: Date | null = null;
    if (nextStartedAtIso) {
      nextStart = new Date(nextStartedAtIso);
    } else if (completed.completedAt) {
      nextStart = completed.completedAt;
    }

    next.status = StageProgressStatus.IN_PROGRESS;
    next.startedAt = nextStart;
    next.dueDate = nextStart
      ? computeStageDueDate(nextStart, next.stageTemplate)
      : null;
    await this.progressRepo.save(next);

    proc.currentStageProgressId = next.id;
    await this.processRepo.save(proc);
    return this.findOne(proc.id);
  }

  async getHome(year: number, month: number) {
    const [dashboard, calendar] = await Promise.all([
      this.getDashboard(),
      this.calendarService.getBootstrap(year, month),
    ]);
    return { dashboard, calendar };
  }

  async getDashboard() {
    const now = new Date();

    const [
      activeProcesses,
      totalClients,
      completedProcesses,
      followUpAlerts,
      meetings,
    ] = await Promise.all([
      this.processRepo.find({
        where: { status: ClientProcessStatus.ACTIVE },
        relations: {
          client: true,
          processTemplate: true,
          stageProgresses: { stageTemplate: true },
        },
      }),
      this.clientRepo.count(),
      this.processRepo.count({
        where: { status: ClientProcessStatus.COMPLETED },
      }),
      this.clientsService.getFollowUpAlerts(30, 12),
      this.meetingRepo
        .createQueryBuilder('m')
        .innerJoinAndSelect('m.stageProgress', 'sp')
        .innerJoinAndSelect('sp.clientProcess', 'cp')
        .innerJoinAndSelect('cp.client', 'client')
        .where('m.status = :status', { status: MeetingStatus.SCHEDULED })
        .andWhere('m.scheduledAt >= :now', { now })
        .orderBy('m.scheduledAt', 'ASC')
        .take(8)
        .getMany(),
    ]);

    const active = activeProcesses.filter(
      (p) => !isSeguimientoTemplate(p.processTemplate),
    );

    const overdue: Array<{
      clientName: string;
      processId: string;
      stageName: string;
      dueDate: Date;
    }> = [];

    const upcomingMeetings = meetings.map((m) => ({
      id: m.id,
      title: m.title,
      scheduledAt: m.scheduledAt,
      clientName: m.stageProgress?.clientProcess?.client?.name ?? '—',
    }));

    for (const proc of active) {
      const current = proc.stageProgresses?.find(
        (sp) => sp.status === StageProgressStatus.IN_PROGRESS,
      );
      if (current?.dueDate && new Date(current.dueDate) < now) {
        overdue.push({
          clientName: proc.client.name,
          processId: proc.id,
          stageName: current.stageTemplate.name,
          dueDate: current.dueDate,
        });
      }
    }

    const stageMap = new Map<
      string,
      {
        stageName: string;
        stageOrder: number;
        templateName: string;
        items: Array<{
          processId: string;
          clientId: string;
          clientName: string;
          company: string | null;
          dueDate: Date | null;
          overdue: boolean;
        }>;
      }
    >();

    for (const p of active) {
      const current = p.stageProgresses?.find(
        (sp) => sp.status === StageProgressStatus.IN_PROGRESS,
      );
      const stageName = current?.stageTemplate?.name ?? 'Sin etapa asignada';
      const stageOrder = current?.stageTemplate?.orderIndex ?? 9999;
      const key = `${p.processTemplate.name}::${stageName}`;
      const dueDate = current?.dueDate ?? null;
      const itemOverdue = !!dueDate && new Date(dueDate) < now;

      if (!stageMap.has(key)) {
        stageMap.set(key, {
          stageName,
          stageOrder,
          templateName: p.processTemplate.name,
          items: [],
        });
      }
      stageMap.get(key)!.items.push({
        processId: p.id,
        clientId: p.client.id,
        clientName: p.client.name,
        company: p.client.company,
        dueDate,
        overdue: itemOverdue,
      });
    }

    const processesByStage = [...stageMap.values()]
      .sort((a, b) => {
        if (a.templateName !== b.templateName) {
          return a.templateName.localeCompare(b.templateName, 'es');
        }
        return a.stageOrder - b.stageOrder;
      })
      .map((group) => ({
        stageName: group.stageName,
        stageOrder: group.stageOrder,
        templateName: group.templateName,
        count: group.items.length,
        items: group.items.sort((a, b) =>
          a.clientName.localeCompare(b.clientName, 'es'),
        ),
      }));

    return {
      stats: {
        totalClients,
        activeProcesses: active.length,
        completedProcesses,
        overdueStages: overdue.length,
        needsFollowUp: followUpAlerts.length,
      },
      activeProcesses: active.map((p) => {
        const current = p.stageProgresses?.find(
          (sp) => sp.status === StageProgressStatus.IN_PROGRESS,
        );
        return {
          id: p.id,
          clientId: p.client.id,
          clientName: p.client.name,
          company: p.client.company,
          templateName: p.processTemplate.name,
          currentStage: current?.stageTemplate?.name ?? '—',
          dueDate: current?.dueDate ?? null,
          status: p.status,
        };
      }),
      processesByStage,
      overdue,
      upcomingMeetings,
      followUpAlerts,
    };
  }
}
