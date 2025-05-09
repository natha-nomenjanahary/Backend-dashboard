import { Controller, Get, Query } from '@nestjs/common';
import { AgentsService } from './agents.service';


@Controller('agents')
export class AgentsController {
    constructor(
        private readonly agentsService: AgentsService,
    ) {}

    @Get('agents-stats')
    async getAgentsStats(
        @Query('mois') mois?: number,
        @Query('annee') annee?: number,
    ) {
        return this.agentsService.getAgentsWithTicketStats(mois, annee);
    }

}
