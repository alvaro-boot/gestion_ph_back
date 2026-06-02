import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { CreateCalendarMeetingDto } from './dto/create-calendar-meeting.dto';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly service: CalendarService) {}

  @Get('bootstrap')
  bootstrap(@Query('year') year: string, @Query('month') month: string) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) {
      throw new BadRequestException('Año inválido');
    }
    if (!Number.isFinite(m) || m < 1 || m > 12) {
      throw new BadRequestException('Mes inválido');
    }
    return this.service.getBootstrap(y, m);
  }

  @Get()
  month(@Query('year') year: string, @Query('month') month: string) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) {
      throw new BadRequestException('Año inválido');
    }
    if (!Number.isFinite(m) || m < 1 || m > 12) {
      throw new BadRequestException('Mes inválido');
    }
    return this.service.getMonth(y, m);
  }

  @Get('picker-options')
  pickerOptions() {
    return this.service.getPickerOptions();
  }

  @Post('deliveries')
  createDelivery(@Body() dto: CreateCalendarEventDto) {
    return this.service.createDelivery(dto);
  }

  @Patch('deliveries/:id')
  updateDelivery(@Param('id') id: string, @Body() dto: UpdateCalendarEventDto) {
    return this.service.updateDelivery(id, dto);
  }

  @Delete('deliveries/:id')
  removeDelivery(@Param('id') id: string) {
    return this.service.removeDelivery(id);
  }

  @Post('meetings')
  createMeeting(@Body() dto: CreateCalendarMeetingDto) {
    return this.service.createMeeting(dto);
  }

  @Post('meetings/:id/cancel')
  cancelMeeting(@Param('id') id: string) {
    return this.service.cancelMeeting(id);
  }
}
