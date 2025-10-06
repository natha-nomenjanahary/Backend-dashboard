import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from './entities/Agent.entity';
import { SousCategoriesModule } from 'src/sous-categories/sous-categories.module'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent]),
    SousCategoriesModule,  
  ],
  providers: [AgentsService],
  controllers: [AgentsController],
  exports: [AgentsService]
})
export class AgentsModule {}
