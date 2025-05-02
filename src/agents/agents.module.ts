import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from './entities/Agent.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Agent])],
  providers: [AgentsService],
  controllers: [AgentsController],
  exports: [AgentsService]
})
export class AgentsModule {}
