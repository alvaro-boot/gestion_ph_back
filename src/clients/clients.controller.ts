import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

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
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
