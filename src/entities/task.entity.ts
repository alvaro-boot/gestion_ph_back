import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { StageProgress } from './stage-progress.entity';
import { TaskStatus } from '../common/enums';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  stageProgressId: string;

  @ManyToOne(() => StageProgress, (sp) => sp.tasks, { onDelete: 'CASCADE' })
  stageProgress: StageProgress;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'datetime', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'varchar', default: TaskStatus.PENDING })
  status: TaskStatus;
}
