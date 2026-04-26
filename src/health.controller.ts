import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  root() {
    return { service: 'mezon-vocab-bot', status: 'ok' };
  }

  @Get('health')
  health() {
    return { status: 'ok', uptime: process.uptime() };
  }
}
