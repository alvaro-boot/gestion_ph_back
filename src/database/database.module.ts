import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessTemplate } from '../entities/process-template.entity';
import { StageTemplate } from '../entities/stage-template.entity';
import { User } from '../entities/user.entity';
import { SeedService } from './seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProcessTemplate, StageTemplate, User])],
  providers: [SeedService],
})
export class DatabaseModule {}
