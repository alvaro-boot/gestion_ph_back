import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessTemplate } from '../entities/process-template.entity';
import { StageTemplate } from '../entities/stage-template.entity';
import { CreateProcessTemplateDto } from './dto/create-process-template.dto';
import { UpdateProcessTemplateDto } from './dto/update-process-template.dto';
import { CreateStageDto } from './dto/create-stage.dto';
import { StageType } from '../common/enums';

@Injectable()
export class ProcessTemplatesService {
  constructor(
    @InjectRepository(ProcessTemplate)
    private readonly templateRepo: Repository<ProcessTemplate>,
    @InjectRepository(StageTemplate)
    private readonly stageRepo: Repository<StageTemplate>,
  ) {}

  async findAll() {
    const templates = await this.templateRepo.find({
      relations: { stages: true },
      order: { createdAt: 'DESC' },
    });
    for (const t of templates) {
      t.stages?.sort((a, b) => a.orderIndex - b.orderIndex);
    }
    return templates;
  }

  async findOne(id: string) {
    const template = await this.templateRepo.findOne({
      where: { id },
      relations: { stages: true },
    });
    if (!template) {
      throw new NotFoundException('Plantilla de proceso no encontrada');
    }
    template.stages.sort((a, b) => a.orderIndex - b.orderIndex);
    return template;
  }

  async create(dto: CreateProcessTemplateDto) {
    const template = this.templateRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      isDefault: dto.isDefault ?? false,
    });
    const saved = await this.templateRepo.save(template);
    if (dto.stages?.length) {
      await this.replaceStages(saved.id, dto.stages);
    }
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateProcessTemplateDto) {
    const template = await this.findOne(id);
    if (dto.name !== undefined) template.name = dto.name;
    if (dto.description !== undefined) template.description = dto.description ?? null;
    if (dto.isDefault !== undefined) template.isDefault = dto.isDefault;
    await this.templateRepo.save(template);
    if (dto.stages) {
      await this.replaceStages(id, dto.stages);
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    const template = await this.findOne(id);
    await this.templateRepo.remove(template);
    return { deleted: true };
  }

  private async replaceStages(processTemplateId: string, stages: CreateStageDto[]) {
    await this.stageRepo.delete({ processTemplateId });
    const entities = stages.map((s) =>
      this.stageRepo.create({
        processTemplateId,
        name: s.name,
        description: s.description ?? null,
        orderIndex: s.orderIndex,
        stageType: s.stageType ?? StageType.GENERAL,
        durationDays: s.durationDays ?? null,
        minDurationDays: s.minDurationDays ?? null,
        maxDurationDays: s.maxDurationDays ?? null,
        formDeadlineDays: s.formDeadlineDays ?? null,
        formUrl: s.formUrl ?? null,
      }),
    );
    await this.stageRepo.save(entities);
  }
}
