import { Controller, Get, Query } from '@nestjs/common';
import { AgentsService } from './agents.service';


@Controller('agents')
export class AgentsController {
    constructor(
        private readonly agentsService: AgentsService,
    ) {}

    //1.Liste des agents avec statistique
    @Get('agents-stats')
    async getAgentsStats(
        @Query('mois') mois?: number,
        @Query('annee') annee?: number,
    ) {
        console.time('agents-stats');
        const result = await this.agentsService.getAgentsWithTicketStats(mois, annee);
        console.timeEnd('agents-stats');
        return result;
    }

    //2. Info d'un agent
    @Get('Info')
    async getInfoAgentParId(
        @Query('idAgent') idAgent : number,
        @Query('mois') mois?: number,
        @Query('annee') annee?: number,
    ) {
        return this.agentsService.getInfoAgentParId(idAgent, mois, annee);
    }
}
