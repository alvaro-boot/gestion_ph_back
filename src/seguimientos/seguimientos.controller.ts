import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { SeguimientosService } from './seguimientos.service';
import { CreateSeguimientoDto } from './dto/create-seguimiento.dto';
import { UpdateSeguimientoDto } from './dto/update-seguimiento.dto';

@Controller()
export class SeguimientosController {
  constructor(private readonly service: SeguimientosService) {}

  @Get('clients/:clientId/seguimientos')
  findByClient(@Param('clientId') clientId: string) {
    return this.service.findByClient(clientId);
  }

  @Post('seguimientos')
  create(@Body() dto: CreateSeguimientoDto) {
    return this.service.create(dto);
  }

  @Patch('seguimientos/:id')
  update(@Param('id') id: string, @Body() dto: UpdateSeguimientoDto) {
    return this.service.update(id, dto);
  }

  @Delete('seguimientos/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
