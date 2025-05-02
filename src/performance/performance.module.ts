import { Module } from '@nestjs/common';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { TicketsModule } from '../tickets/tickets.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [TicketsModule,AgentsModule],
  controllers: [PerformanceController],
  providers: [PerformanceService]
})
export class PerformanceModule {}
