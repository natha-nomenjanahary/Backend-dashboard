import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SousCategorie } from './entities/SousCategorie.entity';
import { SousCategorieService } from './sous-categories.service';
import { SousCategoriesController } from './sous-categories.controller';
import { Ticket } from '../tickets/entities/Ticket.entity';
import { Agent } from '../agents/entities/Agent.entity'; 
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SousCategorie, Ticket, Agent]),
    TicketsModule,
  ],
  providers: [SousCategorieService],
  controllers: [SousCategoriesController],
  exports: [SousCategorieService],
})
export class SousCategoriesModule {}
