import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { ProcessTemplate } from './process-template.entity';
import { StageProgress } from './stage-progress.entity';
import { ClientProcessStatus } from '../common/enums';

@Entity('client_processes')
export class ClientProcess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @ManyToOne(() => Client, (c) => c.processes, { onDelete: 'CASCADE' })
  client: Client;

  @Column()
  processTemplateId: string;

  @ManyToOne(() => ProcessTemplate, (pt) => pt.clientProcesses)
  processTemplate: ProcessTemplate;

  @Column({ type: 'varchar', default: ClientProcessStatus.ACTIVE })
  status: ClientProcessStatus;

  @Column({ type: 'varchar', nullable: true })
  currentStageProgressId: string | null;

  @OneToMany(() => StageProgress, (sp) => sp.clientProcess, { cascade: true })
  stageProgresses: StageProgress[];

  /** Inicio real del onboarding (opcional si no se conoce la fecha). */
  @Column({ type: 'datetime', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
