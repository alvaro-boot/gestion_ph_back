import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Meeting } from '../entities/meeting.entity';
import { StageProgress } from '../entities/stage-progress.entity';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { MeetingStatus } from '../common/enums';

@Injectable()
export class MeetingsService {
  constructor(
    @InjectRepository(Meeting)
    private readonly meetingRepo: Repository<Meeting>,
    @InjectRepository(StageProgress)
    private readonly progressRepo: Repository<StageProgress>,
  ) {}

  async findByMonth(year: number, month: number) {
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
      .where('m.scheduledAt >= :start', { start })
      .andWhere('m.scheduledAt <= :end', { end })
      .orderBy('m.scheduledAt', 'ASC')
      .getMany();

    return meetings.map((m) => ({
      id: m.id,
      title: m.title,
      scheduledAt: m.scheduledAt,
      durationMinutes: m.durationMinutes,
      status: m.status,
      clientName: m.stageProgress?.clientProcess?.client?.name ?? '—',
      processId: m.stageProgress?.clientProcess?.id ?? null,
    }));
  }

  async findUpcoming(limit = 10) {
    const now = new Date();
    return this.meetingRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.stageProgress', 'sp')
      .leftJoinAndSelect('sp.clientProcess', 'cp')
      .leftJoinAndSelect('cp.client', 'client')
      .where('m.scheduledAt >= :now', { now })
      .andWhere('m.status = :status', { status: MeetingStatus.SCHEDULED })
      .orderBy('m.scheduledAt', 'ASC')
      .take(limit)
      .getMany();
  }

  async create(dto: CreateMeetingDto) {
    const progress = await this.progressRepo.findOne({
      where: { id: dto.stageProgressId },
    });
    if (!progress) {
      throw new NotFoundException('Etapa del proceso no encontrada');
    }
    const meeting = this.meetingRepo.create({
      stageProgressId: dto.stageProgressId,
      title: dto.title,
      scheduledAt: new Date(dto.scheduledAt),
      durationMinutes: dto.durationMinutes ?? 60,
      location: dto.location ?? null,
      notes: dto.notes ?? null,
      status: dto.status ?? MeetingStatus.SCHEDULED,
    });
    return this.meetingRepo.save(meeting);
  }

  async updateStatus(id: string, status: MeetingStatus) {
    const meeting = await this.meetingRepo.findOne({ where: { id } });
    if (!meeting) throw new NotFoundException('Reunión no encontrada');
    meeting.status = status;
    return this.meetingRepo.save(meeting);
  }

  async update(id: string, dto: UpdateMeetingDto) {
    const meeting = await this.meetingRepo.findOne({ where: { id } });
    if (!meeting) throw new NotFoundException('Reunión no encontrada');

    if (meeting.status === MeetingStatus.CANCELLED) {
      throw new BadRequestException('Esta reunión ya fue cancelada.');
    }
    if (meeting.status === MeetingStatus.COMPLETED && dto.status !== MeetingStatus.CANCELLED) {
      throw new BadRequestException('Esta reunión ya fue terminada.');
    }

    if (dto.title !== undefined) meeting.title = dto.title;
    if (dto.scheduledAt !== undefined) {
      meeting.scheduledAt = new Date(dto.scheduledAt);
    }
    if (dto.notes !== undefined) meeting.notes = dto.notes ?? null;
    if (dto.status !== undefined) {
      if (dto.status === MeetingStatus.COMPLETED && !dto.notes?.trim()) {
        throw new BadRequestException(
          'Indica notas al marcar la reunión como terminada.',
        );
      }
      meeting.status = dto.status;
    }

    return this.meetingRepo.save(meeting);
  }
}
