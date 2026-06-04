import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { MeetingStatus } from '../common/enums';

/** Reunión del calendario sin vínculo a un conjunto / proceso de onboarding. */
@Entity('general_meetings')
@Index(['status', 'scheduledAt'])
export class GeneralMeeting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
