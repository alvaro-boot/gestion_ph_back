import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowUp } from '../entities/follow-up.entity';
import { Client } from '../entities/client.entity';
import { ClientProcess } from '../entities/client-process.entity';
import { CreateSeguimientoDto } from './dto/create-seguimiento.dto';
import { UpdateSeguimientoDto } from './dto/update-seguimiento.dto';
import { ClientProcessStatus, FollowUpType } from '../common/enums';
import { isSeguimientoTemplate } from '../common/seguimiento-template';

@Injectable()
export class SeguimientosService {
  constructor(
    @InjectRepository(FollowUp)
    private readonly followUpRepo: Repository<FollowUp>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(ClientProcess)
    private readonly processRepo: Repository<ClientProcess>,
  ) {}

  private async assertCanRegisterFollowUp(clientId: string) {
    const processes = await this.processRepo.find({
      where: { clientId },
      relations: { processTemplate: true },
    });
    const hasOnboarding = processes.some(
      (p) =>
        (p.status === ClientProcessStatus.ACTIVE ||
          p.status === ClientProcessStatus.COMPLETED) &&
        !isSeguimientoTemplate(p.processTemplate),
    );
    if (!hasOnboarding) {
      throw new BadRequestException(
        'El cliente debe tener un proceso de onboarding iniciado para registrar seguimientos.',
      );
    }
  }

  async findByClient(clientId: string) {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    return this.followUpRepo.find({
      where: { clientId },
      relations: { clientProcess: { processTemplate: true } },
      order: { occurredAt: 'DESC' },
    });
  }

  async create(dto: CreateSeguimientoDto) {
    const client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    await this.assertCanRegisterFollowUp(dto.clientId);

    if (dto.clientProcessId) {
      const proc = await this.processRepo.findOne({
        where: { id: dto.clientProcessId, clientId: dto.clientId },
        relations: { processTemplate: true },
      });
      if (!proc) {
        throw new NotFoundException('Proceso del cliente no encontrado');
      }
      if (isSeguimientoTemplate(proc.processTemplate)) {
        throw new BadRequestException(
          'Vincula el seguimiento al proceso de onboarding, no a un proceso «Seguimiento».',
        );
      }
      if (
        proc.status !== ClientProcessStatus.COMPLETED &&
        proc.status !== ClientProcessStatus.ACTIVE
      ) {
        throw new BadRequestException(
          'El proceso vinculado debe estar en curso o completado.',
        );
      }
    }

    const entity = this.followUpRepo.create({
      clientId: dto.clientId,
      clientProcessId: dto.clientProcessId ?? null,
      title: dto.title,
      description: dto.description ?? null,
      followUpType: dto.followUpType ?? FollowUpType.NOTE,
      occurredAt: new Date(dto.occurredAt),
    });

    return this.followUpRepo.save(entity);
  }

  async update(id: string, dto: UpdateSeguimientoDto) {
    const item = await this.followUpRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Seguimiento no encontrado');

    if (dto.title !== undefined) item.title = dto.title;
    if (dto.description !== undefined) item.description = dto.description ?? null;
    if (dto.occurredAt !== undefined) item.occurredAt = new Date(dto.occurredAt);
    if (dto.nextActionAt !== undefined) {
      const raw = dto.nextActionAt;
      item.nextActionAt =
        raw != null && String(raw).trim() !== '' ? new Date(raw) : null;
    }
    if (dto.followUpType !== undefined) item.followUpType = dto.followUpType;

    return this.followUpRepo.save(item);
  }

  async remove(id: string) {
    const item = await this.followUpRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Seguimiento no encontrado');
    await this.followUpRepo.remove(item);
    return { deleted: true };
  }
}
