import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { createConnection } from 'typeorm';
import { Agent } from '../agents/entities/Agent.entity';
import { Ticket } from './entities/Ticket.entity';


@Module({
  controllers: [TicketsController],
  providers: [TicketsService,
    {
      provide: 'base',
      useFactory: async () => {
        return await createConnection({
          type: 'mysql',
          host: 'localhost',
          port: 3306,
          username: 'root',
          password: '',
          database: 'base',
          entities: [Agent, Ticket]
        });
      },
    },
  ],
  exports: [TicketsService],
})
export class TicketsModule {}
