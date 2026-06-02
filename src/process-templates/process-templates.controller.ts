import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ProcessTemplatesService } from './process-templates.service';
import { CreateProcessTemplateDto } from './dto/create-process-template.dto';
import { UpdateProcessTemplateDto } from './dto/update-process-template.dto';

@Controller('process-templates')
export class ProcessTemplatesController {
  constructor(private readonly service: ProcessTemplatesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProcessTemplateDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProcessTemplateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
