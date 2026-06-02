import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
import { StageProgress } from '../entities/stage-progress.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskStatus } from '../common/enums';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(StageProgress)
    private readonly progressRepo: Repository<StageProgress>,
  ) {}

  async create(dto: CreateTaskDto) {
    const progress = await this.progressRepo.findOne({
      where: { id: dto.stageProgressId },
    });
    if (!progress) {
      throw new NotFoundException('Etapa del proceso no encontrada');
    }
    const task = this.taskRepo.create({
      stageProgressId: dto.stageProgressId,
      title: dto.title,
      description: dto.description ?? null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      status: dto.status ?? TaskStatus.PENDING,
    });
    return this.taskRepo.save(task);
  }

  async updateStatus(id: string, status: TaskStatus) {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    task.status = status;
    if (status === TaskStatus.COMPLETED) {
      task.completedAt = new Date();
    }
    return this.taskRepo.save(task);
  }
}
