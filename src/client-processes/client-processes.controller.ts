import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ClientProcessesService } from './client-processes.service';
import { StartProcessDto } from './dto/start-process.dto';
import { UpdateStageProgressDto } from './dto/update-stage-progress.dto';
import { AdvanceStageDto } from './dto/advance-stage.dto';
import { SetCurrentStageDto } from './dto/set-current-stage.dto';

@Controller('client-processes')
export class ClientProcessesController {
  constructor(private readonly service: ClientProcessesService) {}

  @Get('dashboard')
  dashboard() {
    return this.service.getDashboard();
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('start')
  start(@Body() dto: StartProcessDto) {
    return this.service.start(dto);
  }

  @Post(':id/set-current-stage')
  setCurrentStage(@Param('id') id: string, @Body() dto: SetCurrentStageDto) {
    return this.service.setCurrentStage(id, dto);
  }

  @Patch('stages/:progressId')
  updateStage(
    @Param('progressId') progressId: string,
    @Body() dto: UpdateStageProgressDto,
  ) {
    return this.service.updateStageProgress(progressId, dto);
  }

  @Post('stages/:progressId/advance')
  advance(
    @Param('progressId') progressId: string,
    @Body() dto: AdvanceStageDto,
  ) {
    return this.service.advanceStage(progressId, dto);
  }
}
