import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../entities/task.entity';
import { StageProgress } from '../entities/stage-progress.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Task, StageProgress])],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
