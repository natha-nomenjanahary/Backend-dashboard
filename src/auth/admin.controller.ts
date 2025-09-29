import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Get('test')
  @Roles('admin','Chef de service') // autorise selon role ou function
  test(@Req() req) {
    return { ok: true, user: req.user };
  }
}
