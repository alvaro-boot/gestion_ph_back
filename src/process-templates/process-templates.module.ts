import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessTemplate } from '../entities/process-template.entity';
import { StageTemplate } from '../entities/stage-template.entity';
import { ProcessTemplatesService } from './process-templates.service';
import { ProcessTemplatesController } from './process-templates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProcessTemplate, StageTemplate])],
  controllers: [ProcessTemplatesController],
  providers: [ProcessTemplatesService],
  exports: [ProcessTemplatesService],
})
export class ProcessTemplatesModule {}
