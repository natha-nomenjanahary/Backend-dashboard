import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentsModule } from './agents/agents.module';
import { TicketsModule } from './tickets/tickets.module';
import { PerformanceModule } from './performance/performance.module';
import { Agent } from './agents/entities/Agent.entity';
import { Ticket } from './tickets/entities/Ticket.entity';
import { SousCategoriesModule } from './sous-categories/sous-categories.module';
import { SousCategorie } from './sous-categories/entities/SousCategorie.entity'


@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql', 
      host: 'localhost', 
      port: 3306, 
      username: 'root', 
      password: '', 
      database: 'base', 
      entities: [Agent,Ticket,SousCategorie], 
      synchronize: false, // Attention : ne pas utiliser en production, cela peut supprimer des données
   }),
    AgentsModule,
    TicketsModule,
    PerformanceModule,
    SousCategoriesModule,
],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
