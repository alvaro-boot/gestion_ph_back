import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEvent } from '../entities/calendar-event.entity';
import { Meeting } from '../entities/meeting.entity';
import { Client } from '../entities/client.entity';
import { ClientProcess } from '../entities/client-process.entity';
import { StageProgress } from '../entities/stage-progress.entity';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { MeetingsModule } from '../meetings/meetings.module';
import { ClientsModule } from '../clients/clients.module';
import { SeguimientosModule } from '../seguimientos/seguimientos.module';
import { FollowUp } from '../entities/follow-up.entity';
import { GeneralMeeting } from '../entities/general-meeting.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CalendarEvent,
      Meeting,
      GeneralMeeting,
      Client,
      ClientProcess,
      StageProgress,
      FollowUp,
    ]),
    MeetingsModule,
    ClientsModule,
    SeguimientosModule,
  ],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
