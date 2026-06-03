import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('clients')
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  /** Lista mínima para selector público del reporte de conjuntos. */
  @Public()
  @Get('conjunto-picker')
  conjuntoPicker() {
    return this.service.findConjuntoPicker();
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('follow-up-alerts')
  followUpAlerts() {
    return this.service.getFollowUpAlerts();
  }

  @Get(':id/update-history')
  updateHistory(@Param('id') id: string) {
    return this.service.getUpdateHistory(id);
  }

  @Public()
  @Get(':id/conjunto-report')
  conjuntoReport(@Param('id') id: string) {
    return this.service.getConjuntoReport(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @Req() req: { user?: { id: string; name: string; email: string } },
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: { user?: { role: string } },
  ) {
    if (req?.user?.role !== 'admin') {
      throw new ForbiddenException(
        'Solo el administrador puede eliminar clientes',
      );
    }
    return this.service.remove(id);
  }
}
