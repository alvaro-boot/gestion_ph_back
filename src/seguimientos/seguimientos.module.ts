import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FollowUp } from '../entities/follow-up.entity';
import { Client } from '../entities/client.entity';
import { ClientProcess } from '../entities/client-process.entity';
import { SeguimientosService } from './seguimientos.service';
import { SeguimientosController } from './seguimientos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FollowUp, Client, ClientProcess])],
  controllers: [SeguimientosController],
  providers: [SeguimientosService],
  exports: [SeguimientosService],
})
export class SeguimientosModule {}
