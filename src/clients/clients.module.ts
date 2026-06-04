import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../entities/client.entity';
import { ClientProcess } from '../entities/client-process.entity';
import { ClientUpdateLog } from '../entities/client-update-log.entity';
import { FollowUp } from '../entities/follow-up.entity';
import { Meeting } from '../entities/meeting.entity';
import { CalendarEvent } from '../entities/calendar-event.entity';
import { StageProgress } from '../entities/stage-progress.entity';
import { ProcessTemplate } from '../entities/process-template.entity';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Client,
      ClientProcess,
      ProcessTemplate,
      ClientUpdateLog,
      FollowUp,
      Meeting,
      CalendarEvent,
      StageProgress,
    ]),
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule implements OnModuleInit {
  constructor(private readonly clientsService: ClientsService) {}

  async onModuleInit() {
    try {
      await this.clientsService.syncLegacyNextContacts();
    } catch {
      // No bloquear el arranque si la BD aún no tiene las columnas nuevas.
    }
  }
}
