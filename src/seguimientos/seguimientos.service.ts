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
import { ClientProcessStatus, FollowUpType } from '../common/enums';

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
    const hasProcess = await this.processRepo.exists({
      where: [
        { clientId, status: ClientProcessStatus.ACTIVE },
        { clientId, status: ClientProcessStatus.COMPLETED },
      ],
    });
    if (!hasProcess) {
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
      });
      if (!proc) {
        throw new NotFoundException('Proceso del cliente no encontrado');
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
      nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : null,
    });

    return this.followUpRepo.save(entity);
  }

  async remove(id: string) {
    const item = await this.followUpRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Seguimiento no encontrado');
    await this.followUpRepo.remove(item);
    return { deleted: true };
  }
}
