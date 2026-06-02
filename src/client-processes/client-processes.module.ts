import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientProcess } from '../entities/client-process.entity';
import { StageProgress } from '../entities/stage-progress.entity';
import { ProcessTemplate } from '../entities/process-template.entity';
import { Client } from '../entities/client.entity';
import { Meeting } from '../entities/meeting.entity';
import { ClientProcessesService } from './client-processes.service';
import { ClientProcessesController } from './client-processes.controller';
import { SeguimientoProcessService } from './seguimiento-process.service';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [
    ClientsModule,
    TypeOrmModule.forFeature([
      ClientProcess,
      StageProgress,
      ProcessTemplate,
      Client,
      Meeting,
    ]),
  ],
  controllers: [ClientProcessesController],
  providers: [ClientProcessesService, SeguimientoProcessService],
  exports: [ClientProcessesService, SeguimientoProcessService],
})
export class ClientProcessesModule {}
