import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClientProcess } from './client-process.entity';
import { FollowUp } from './follow-up.entity';
import { ClientUpdateLog } from './client-update-log.entity';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  contactName: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  company: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => ClientProcess, (cp) => cp.client)
  processes: ClientProcess[];

  @OneToMany(() => FollowUp, (f) => f.client)
  followUps: FollowUp[];

  @OneToMany(() => ClientUpdateLog, (log) => log.client)
  updateLogs: ClientUpdateLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
