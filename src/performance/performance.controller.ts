import { Controller, Get, Query } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { TicketsService } from '../tickets/tickets.service';
import { AgentsService } from '../agents/agents.service';

export interface TicketWithAgent {
  idTicket: number;
  date_create: Date;
  state: number;
  sousCategorie: number;
  agentId: number;
  agentName: string;
}

interface AgentScore {
  agentId: number;
  agentName: string;
  score: number;
}

@Controller('performance')
export class PerformanceController {
  constructor(
    private readonly performanceService: PerformanceService,
    private readonly ticketService: TicketsService,
    private readonly agentService: AgentsService,
  ) {}

  //score depend de la complexité pour tous les agents
  // @Get('scores-agents')
  // async getScoresParAgent(): Promise<AgentScore[]> {
  //   const tickets: TicketWithAgent[] = await this.ticketService.getTicketsAvecAgents();

  //   const scores: AgentScore[] = this.performanceService.calculerScoreParAgent(tickets);

  //   return scores;
  // }

  //repartition par mois en pourcentage
  @Get('tickets-repartis-par-agent')
  async getRepartitionParAgent(
    @Query('mois') mois?: number,
    @Query('annee') annee?: number,
  ) {
    return this.performanceService.getRepartitionTicketsParAgentParMois(mois, annee);
  }




  @Get('tickets-realises-agents')
  async getTicketsRealisesParAgent() {
    return await this.ticketService.getTicketsRealisesParAgent();
  }
}
