import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  private requireAdmin(req: any) {
    if (req?.user?.role !== 'admin') {
      throw new ForbiddenException('Solo el administrador puede gestionar usuarios');
    }
  }

  @Get()
  list(@Req() req: any) {
    this.requireAdmin(req);
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateUserDto, @Req() req: any) {
    this.requireAdmin(req);
    return this.service.create(dto);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: any,
  ) {
    this.requireAdmin(req);
    return this.service.setActive(id, dto.isActive);
  }
}

