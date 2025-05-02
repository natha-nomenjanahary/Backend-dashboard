import { Controller, Get } from '@nestjs/common';
import { AgentsService } from './agents.service';

@Controller('agents')
export class AgentsController {
    constructor(private readonly agentsService: AgentsService) {}

    @Get('with-stats')
    getAgentsWithStats() {
        return this.agentsService.getAgentsWithTicketStats();
    }
    
}
