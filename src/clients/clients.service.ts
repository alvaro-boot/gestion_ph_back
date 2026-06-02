import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../entities/client.entity';
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
} from '../common/follow-up-summary';
import { ClientProcessStatus } from '../common/enums';
import { isSeguimientoTemplate } from '../common/seguimiento-template';

export interface AuthUserPayload {
  id: string;
  name: string;
  email: string;
}

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(ClientUpdateLog)
    private readonly updateLogRepo: Repository<ClientUpdateLog>,
  ) {}

  private attachFollowUpSummary<T extends { followUps?: import('../entities/follow-up.entity').FollowUp[] }>(
    client: T,
  ): T & { followUpSummary: FollowUpSummary } {
    return {
      ...client,
      followUpSummary: buildFollowUpSummary(client.followUps),
    };
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
    const clients = await this.clientRepo.find({
      relations: { processes: { processTemplate: true }, followUps: true },
      order: { createdAt: 'DESC' },
    });
    return clients.map((c) =>
      this.attachFollowUpSummary(this.withoutSeguimientoProcesses(c)),
    );
  }

  /** Clientes con mucho tiempo sin seguimiento o próximo contacto vencido. */
  async getFollowUpAlerts(staleDays = 30, limit = 15): Promise<FollowUpAlertRow[]> {
    const clients = await this.clientRepo.find({
      relations: { processes: { processTemplate: true }, followUps: true },
    });

    const rows: FollowUpAlertRow[] = [];

    for (const client of clients) {
      if (!this.clientHasTrackableProcess(client)) continue;

      const summary = buildFollowUpSummary(client.followUps);
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
          stageProgresses: {
            stageTemplate: true,
            meetings: true,
            tasks: true,
          },
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
    return this.attachFollowUpSummary(this.withoutSeguimientoProcesses(client));
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
}
