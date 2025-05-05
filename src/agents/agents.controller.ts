import { Controller, Get } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentStats } from './interfaces/agent-stats.interface';

@Controller('agents')
export class AgentsController {
    constructor(private readonly agentsService: AgentsService) {}

    @Get('with-stats')
    async getAgentsWithTicketStats(): Promise<AgentStats[]> {
        return this.agentsService.getAgentsWithTicketStats();
    }
}
