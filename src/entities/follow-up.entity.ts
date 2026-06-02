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
import { FollowUpType } from '../common/enums';

@Entity('seguimientos')
@Index(['clientId', 'occurredAt'])
export class FollowUp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @ManyToOne(() => Client, (c) => c.followUps, { onDelete: 'CASCADE' })
  client: Client;

  @Column({ type: 'varchar', nullable: true })
  clientProcessId: string | null;

  @ManyToOne(() => ClientProcess, { onDelete: 'SET NULL', nullable: true })
  clientProcess: ClientProcess | null;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', default: FollowUpType.NOTE })
  followUpType: FollowUpType;

  @Column({ type: 'datetime' })
  occurredAt: Date;

  @Column({ type: 'datetime', nullable: true })
  nextActionAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
