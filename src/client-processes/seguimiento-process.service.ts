import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProcess } from '../entities/client-process.entity';
import { ProcessTemplate } from '../entities/process-template.entity';
import { StageProgress } from '../entities/stage-progress.entity';
import {
  ClientProcessStatus,
  StageProgressStatus,
} from '../common/enums';

export const SEGUIMIENTO_TEMPLATE_NAME = 'Seguimiento';

@Injectable()
export class SeguimientoProcessService {
  constructor(
    @InjectRepository(ClientProcess)
    private readonly processRepo: Repository<ClientProcess>,
    @InjectRepository(ProcessTemplate)
    private readonly templateRepo: Repository<ProcessTemplate>,
    @InjectRepository(StageProgress)
    private readonly progressRepo: Repository<StageProgress>,
  ) {}

  isSeguimientoTemplate(template: ProcessTemplate) {
    return (
      template.name.trim().toLowerCase() ===
      SEGUIMIENTO_TEMPLATE_NAME.toLowerCase()
    );
  }

  async getTemplate() {
    return this.templateRepo.findOne({
      where: { name: SEGUIMIENTO_TEMPLATE_NAME },
      relations: { stages: true },
    });
  }

  async hasCompletedOnboarding(clientId: string) {
    const processes = await this.processRepo.find({
      where: { clientId, status: ClientProcessStatus.COMPLETED },
      relations: { processTemplate: true },
    });
    return processes.some((p) => !this.isSeguimientoTemplate(p.processTemplate));
  }

  async ensureProcess(clientId: string) {
    if (!(await this.hasCompletedOnboarding(clientId))) {
      throw new BadRequestException(
        'El cliente debe tener el onboarding completado para el proceso de seguimiento.',
      );
    }

    const template = await this.getTemplate();
    if (!template?.stages?.length) {
      throw new BadRequestException(
        'La plantilla «Seguimiento» no está configurada. Reinicia el backend para crearla.',
      );
    }

    const existing = await this.processRepo.findOne({
      where: {
        clientId,
        processTemplateId: template.id,
        status: ClientProcessStatus.ACTIVE,
      },
      relations: {
        client: true,
        processTemplate: true,
        stageProgresses: { stageTemplate: true },
      },
    });
    if (existing) {
      return existing;
    }

    const stage = [...template.stages].sort(
      (a, b) => a.orderIndex - b.orderIndex,
    )[0];

    const clientProcess = await this.processRepo.save(
      this.processRepo.create({
        clientId,
        processTemplateId: template.id,
        status: ClientProcessStatus.ACTIVE,
        startedAt: null,
      }),
    );

    const progress = await this.progressRepo.save(
      this.progressRepo.create({
        clientProcessId: clientProcess.id,
        stageTemplateId: stage.id,
        status: StageProgressStatus.IN_PROGRESS,
        startedAt: null,
        dueDate: null,
      }),
    );

    clientProcess.currentStageProgressId = progress.id;
    await this.processRepo.save(clientProcess);

    const full = await this.processRepo.findOne({
      where: { id: clientProcess.id },
      relations: {
        client: true,
        processTemplate: true,
        stageProgresses: { stageTemplate: true },
      },
    });
    if (!full) {
      throw new BadRequestException('No se pudo crear el proceso de seguimiento');
    }
    return full;
  }
}
