import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from './entities/Agent.entity';
import { AgentStats } from './interfaces/agent-stats.interface';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
  ) {}

  async getAgentsWithTicketStats(): Promise<AgentStats[]> {
    const agents = await this.agentRepository.find({
      relations: ['tickets'],
    });

    const ID_ETAT_RESOLU = 6;

    return agents.map(agent => {
      const tickets = agent.tickets || [];

      const totalAssignes = tickets.length;
      const resolus = tickets.filter(t => t.statut === String(ID_ETAT_RESOLU));
      const totalResolus = resolus.length;

      const tauxRealisation = totalAssignes > 0 ? totalResolus / totalAssignes : 0;

      const resolusRapides = resolus.filter(t =>
        t.dateResolution && t.dateCreation &&
        (new Date(t.dateResolution).getTime() - new Date(t.dateCreation).getTime()) / (1000 * 3600 * 24) <= 2
      );

      const tauxResolutionRapide = totalResolus > 0 ? resolusRapides.length / totalResolus : 0;

      const volumeTraite = totalResolus;

      const score =
        tauxRealisation * 0.5 +                 // 50%
        tauxResolutionRapide * 0.4 +            // 40%
        (volumeTraite / 100) * 0.1;             // 10%

      return {
        id: agent.idAgent,
        nom: `${agent.prenom} ${agent.nom}`,
        poste: agent.poste,
        nombreTickets: `${totalResolus}/${totalAssignes}`,
        performance: Math.round(score * 5),
      };
    });
  }
}
