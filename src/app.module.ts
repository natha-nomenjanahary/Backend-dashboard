// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AgentsModule } from './agents/agents.module';
import { TicketsModule } from './tickets/tickets.module';
import { PerformanceModule } from './performance/performance.module';
import { SousCategoriesModule } from './sous-categories/sous-categories.module';

import { Agent } from './agents/entities/Agent.entity';
import { Ticket } from './tickets/entities/Ticket.entity';
import { SousCategorie } from './sous-categories/entities/SousCategorie.entity';

@Module({
  imports: [
    // 🔹 Charge les variables .env globalement
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 🔹 Connexion à la base de données
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT ?? '3306', 10), // correction TS
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'base',
      entities: [Agent, Ticket, SousCategorie],
      autoLoadEntities: true,
      synchronize: false, // ⚠️ à désactiver en prod
    }),

    AuthModule,
    AgentsModule,
    TicketsModule,
    PerformanceModule,
    SousCategoriesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
