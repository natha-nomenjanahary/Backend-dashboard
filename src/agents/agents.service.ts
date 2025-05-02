import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from './entities/Agent.entity';


@Injectable()
export class AgentsService {
    constructor(
        @InjectRepository(Agent)
        private readonly agentRepository: Repository<Agent>,
    ) {}
    
    async getAgentsWithTicketStats() {
        const result = await this.agentRepository
          .createQueryBuilder('agent')
          .leftJoin('tincidents', 'ticket', 'ticket.technician = agent.id')
          .select('agent.id', 'id')
          .addSelect("CONCAT(agent.firstname, ' ', agent.lastname)", 'nom')
          .addSelect('agent.function', 'poste')
          .addSelect('COUNT(ticket.id)', 'total')
          .addSelect(`SUM(CASE WHEN ticket.state = 4 THEN 1 ELSE 0 END)`, 'resolu')
          .groupBy('agent.id')
          .getRawMany();
      
        return result.map(row => ({
          id: row.id,
          nom: row.nom,
          poste: row.poste,
          nombre_de_tickets_realises: `${row.resolu}/${row.total}`
        }));
      }
      
    
    
}
