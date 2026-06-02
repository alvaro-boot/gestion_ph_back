import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from './client.entity';

export interface ClientFieldChange {
  field: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
}

@Entity('client_update_logs')
export class ClientUpdateLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @ManyToOne(() => Client, (c) => c.updateLogs, { onDelete: 'CASCADE' })
  client: Client;

  @Column({ type: 'varchar', nullable: true })
  updatedByUserId: string | null;

  @Column({ type: 'varchar', nullable: true })
  updatedByName: string | null;

  @Column({ type: 'simple-json' })
  changes: ClientFieldChange[];

  @CreateDateColumn()
  createdAt: Date;
}
