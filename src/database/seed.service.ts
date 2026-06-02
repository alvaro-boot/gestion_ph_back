import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { ProcessTemplate } from '../entities/process-template.entity';
import { StageTemplate } from '../entities/stage-template.entity';
import { User } from '../entities/user.entity';
import { StageType } from '../common/enums';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(ProcessTemplate)
    private readonly templateRepo: Repository<ProcessTemplate>,
    @InjectRepository(StageTemplate)
    private readonly stageRepo: Repository<StageTemplate>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.seedAdmin();
    await this.seedProcessTemplate();
    await this.seedSeguimientoTemplate();
  }

  private async seedAdmin() {
    const email = this.config.get<string>('ADMIN_EMAIL', 'admin@cootravir.com');
    const password = this.config.get<string>('ADMIN_PASSWORD', 'Admin123!');
    const name = this.config.get<string>('ADMIN_NAME', 'Administrador');

    const normalized = email.toLowerCase().trim();
    const exists = await this.userRepo.findOne({ where: { email: normalized } });
    if (exists) return;

    const passwordHash = await bcrypt.hash(password, 10);
    await this.userRepo.save(
      this.userRepo.create({
        email: normalized,
        passwordHash,
        name,
        role: 'admin',
      }),
    );
    this.logger.log(`Usuario administrador creado: ${normalized}`);
  }

  private async seedProcessTemplate() {
    const count = await this.templateRepo.count();
    if (count > 0) return;

    this.logger.log('Cargando plantilla de proceso de ejemplo…');

    const template = await this.templateRepo.save(
      this.templateRepo.create({
        name: 'Onboarding de cliente',
        description:
          'Proceso estándar: reunión inicial, recolección de datos, carga, capacitaciones.',
        isDefault: true,
      }),
    );

    const stages: Partial<StageTemplate>[] = [
      {
        processTemplateId: template.id,
        name: 'Reunión inicial',
        description: 'Primera reunión de levantamiento con el cliente',
        orderIndex: 0,
        stageType: StageType.MEETING,
      },
      {
        processTemplateId: template.id,
        name: 'Recolección de datos',
        description: 'El cliente completa el formulario en el plazo indicado',
        orderIndex: 1,
        stageType: StageType.FORM,
        formDeadlineDays: 7,
        formUrl: 'https://forms.example.com/recoleccion',
      },
      {
        processTemplateId: template.id,
        name: 'Subida de datos',
        description: 'Carga y validación de la información recibida',
        orderIndex: 2,
        stageType: StageType.TASK,
        minDurationDays: 3,
        maxDurationDays: 4,
      },
      {
        processTemplateId: template.id,
        name: 'Capacitación a cliente',
        orderIndex: 3,
        stageType: StageType.MEETING,
      },
      {
        processTemplateId: template.id,
        name: 'Capacitación a personal',
        orderIndex: 4,
        stageType: StageType.MEETING,
      },
      {
        processTemplateId: template.id,
        name: 'Capacitación a subclientes',
        orderIndex: 5,
        stageType: StageType.MEETING,
      },
    ];

    await this.stageRepo.save(stages.map((s) => this.stageRepo.create(s)));
    this.logger.log('Plantilla de ejemplo creada.');
  }

  private async seedSeguimientoTemplate() {
    const exists = await this.templateRepo.findOne({
      where: { name: 'Seguimiento' },
    });
    if (exists) return;

    this.logger.log('Creando plantilla Seguimiento (post-onboarding)…');

    const template = await this.templateRepo.save(
      this.templateRepo.create({
        name: 'Seguimiento',
        description:
          'Reuniones y control con clientes que ya completaron el onboarding.',
        isDefault: false,
      }),
    );

    await this.stageRepo.save(
      this.stageRepo.create({
        processTemplateId: template.id,
        name: 'Seguimiento',
        description: 'Reuniones de seguimiento y control con el cliente',
        orderIndex: 0,
        stageType: StageType.MEETING,
      }),
    );
    this.logger.log('Plantilla Seguimiento creada.');
  }
}
