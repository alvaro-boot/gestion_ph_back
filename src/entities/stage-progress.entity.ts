import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClientProcess } from './client-process.entity';
import { StageTemplate } from './stage-template.entity';
import { Meeting } from './meeting.entity';
import { Task } from './task.entity';
import { StageProgressStatus } from '../common/enums';

@Entity('stage_progresses')
export class StageProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientProcessId: string;

  @ManyToOne(() => ClientProcess, (cp) => cp.stageProgresses, {
    onDelete: 'CASCADE',
  })
  clientProcess: ClientProcess;

  @Column()
  stageTemplateId: string;

  @ManyToOne(() => StageTemplate)
  stageTemplate: StageTemplate;

  @Column({ type: 'varchar', default: StageProgressStatus.PENDING })
  status: StageProgressStatus;

  @Column({ type: 'datetime', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => Meeting, (m) => m.stageProgress, { cascade: true })
  meetings: Meeting[];

  @OneToMany(() => Task, (t) => t.stageProgress, { cascade: true })
  tasks: Task[];
}
