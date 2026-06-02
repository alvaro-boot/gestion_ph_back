import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StageTemplate } from './stage-template.entity';
import { ClientProcess } from './client-process.entity';

@Entity('process_templates')
export class ProcessTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: false })
  isDefault: boolean;

  @OneToMany(() => StageTemplate, (stage) => stage.processTemplate, {
    cascade: true,
  })
  stages: StageTemplate[];

  @OneToMany(() => ClientProcess, (cp) => cp.processTemplate)
  clientProcesses: ClientProcess[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
