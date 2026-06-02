import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { MeetingStatus } from '../common/enums';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly service: MeetingsService) {}

  @Get('upcoming')
  upcoming() {
    return this.service.findUpcoming();
  }

  @Get('calendar')
  calendar(@Query('year') year: string, @Query('month') month: string) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) {
      throw new BadRequestException('Año inválido');
    }
    if (!Number.isFinite(m) || m < 1 || m > 12) {
      throw new BadRequestException('Mes inválido');
    }
    return this.service.findByMonth(y, m);
  }

  @Post()
  create(@Body() dto: CreateMeetingDto) {
    return this.service.create(dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: MeetingStatus,
  ) {
    return this.service.updateStatus(id, status);
  }
}
