import { Module } from '@nestjs/common';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { TicketsModule } from '../tickets/tickets.module';
import { AgentsModule } from '../agents/agents.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SousCategoriesModule } from 'src/sous-categories/sous-categories.module';
import { Ticket } from '../tickets/entities/Ticket.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket]), TicketsModule,AgentsModule,SousCategoriesModule],
  controllers: [PerformanceController],
  providers: [PerformanceService]
})
export class PerformanceModule {}
