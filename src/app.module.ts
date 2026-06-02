import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './config/typeorm.config';
import { ProcessTemplatesModule } from './process-templates/process-templates.module';
import { ClientsModule } from './clients/clients.module';
import { ClientProcessesModule } from './client-processes/client-processes.module';
import { MeetingsModule } from './meetings/meetings.module';
import { TasksModule } from './tasks/tasks.module';
import { SeguimientosModule } from './seguimientos/seguimientos.module';
import { CalendarModule } from './calendar/calendar.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: typeOrmConfig,
      inject: [ConfigService],
    }),
    DatabaseModule,
    AuthModule,
    ProcessTemplatesModule,
    ClientsModule,
    ClientProcessesModule,
    MeetingsModule,
    TasksModule,
    SeguimientosModule,
    CalendarModule,
    UsersModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
