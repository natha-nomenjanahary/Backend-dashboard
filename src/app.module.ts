import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentsModule } from './agents/agents.module';
import { TicketsModule } from './tickets/tickets.module';
import { PerformanceModule } from './performance/performance.module';


@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql', 
      host: 'localhost', 
      port: 3306, 
      username: 'root', 
      password: '', 
      database: 'base', 
      entities: [], 
      synchronize: false, // Attention : ne pas utiliser en production, cela peut supprimer des données
  }),
    AgentsModule,
    TicketsModule,
    PerformanceModule,
],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
