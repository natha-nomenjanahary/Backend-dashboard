import { Controller, Get } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { TicketsService } from '../tickets/tickets.service';
import { AgentsService } from '../agents/agents.service';

interface TicketWithAgent {
  categorie: string;
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

  @Get('scores-agents')
  async getScoresParAgent(): Promise<AgentScore[]> {
    const tickets: TicketWithAgent[] = await this.ticketService.getTicketsAvecAgents();

    const scores: AgentScore[] = this.performanceService.calculerScoreParAgent(tickets);

    return scores;
  }

  @Get('tickets-agents')
  async getNombreTicketsParAgent() {
    const agents = await this.agentService.getAllAgents();
    const tickets = await this.ticketService.getTicketsAvecAgents();
    return this.performanceService.getNombreTicketsParAgent(agents, tickets);
  }

  @Get('tickets-realises-agents')
  async getTicketsRealisesParAgent() {
    return await this.ticketService.getTicketsRealisesParAgent();
  }
}
