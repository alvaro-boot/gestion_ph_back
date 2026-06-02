import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProcessTemplate } from './process-template.entity';
import { StageType } from '../common/enums';

@Entity('stage_templates')
export class StageTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  processTemplateId: string;

  @ManyToOne(() => ProcessTemplate, (pt) => pt.stages, {
    onDelete: 'CASCADE',
  })
  processTemplate: ProcessTemplate;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int' })
  orderIndex: number;

  @Column({ type: 'varchar', default: StageType.GENERAL })
  stageType: StageType;

  /** Días calendario fijos para la etapa */
  @Column({ type: 'int', nullable: true })
  durationDays: number | null;

  @Column({ type: 'int', nullable: true })
  minDurationDays: number | null;

  @Column({ type: 'int', nullable: true })
  maxDurationDays: number | null;

  /** Plazo del formulario (días calendario) */
  @Column({ type: 'int', nullable: true })
  formDeadlineDays: number | null;

  @Column({ type: 'varchar', nullable: true })
  formUrl: string | null;
}
