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
        return this.agentsService.getAgentsWithTicketStats(mois, annee);
    }

    //2. Info d'un agent
    @Get('Info')
    async getInfoAgentParNom(
        @Query('nomComplet') nomComplet: string,
        @Query('mois') mois?: number,
        @Query('annee') annee?: number,
    ) {
        return this.agentsService.getInfoAgentParNom(nomComplet, mois, annee);
    }
}
