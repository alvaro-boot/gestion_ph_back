import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { ClientProcess } from './client-process.entity';
import { CalendarEventStatus, CalendarEventType } from '../common/enums';

@Entity('calendar_events')
@Index(['status', 'dueAt'])
export class CalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  client: Client;

  @Column({ type: 'varchar', nullable: true })
  clientProcessId: string | null;

  @ManyToOne(() => ClientProcess, { onDelete: 'SET NULL', nullable: true })
  clientProcess: ClientProcess | null;

  @Column({ type: 'varchar' })
  eventType: CalendarEventType;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'datetime' })
  dueAt: Date;

  @Column({ type: 'varchar', default: CalendarEventStatus.ACTIVE })
  status: CalendarEventStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
