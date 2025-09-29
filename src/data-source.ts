import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Agent } from './agents/entities/Agent.entity';
import { Ticket } from './tickets/entities/Ticket.entity';
import { SousCategorie } from './sous-categories/entities/SousCategorie.entity';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: '', 
  database: 'base',
  entities: [Agent, Ticket, SousCategorie],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
