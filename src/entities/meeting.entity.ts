import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { StageProgress } from './stage-progress.entity';
import { MeetingStatus } from '../common/enums';

@Entity('meetings')
export class Meeting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  stageProgressId: string;

  @ManyToOne(() => StageProgress, (sp) => sp.meetings, { onDelete: 'CASCADE' })
  stageProgress: StageProgress;

  @Column()
  title: string;

  @Column({ type: 'datetime' })
  scheduledAt: Date;

  @Column({ type: 'int', default: 60 })
  durationMinutes: number;

  @Column({ type: 'varchar', nullable: true })
  location: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', default: MeetingStatus.SCHEDULED })
  status: MeetingStatus;
}
