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
    
    async getAllAgentsWithPoste(): Promise<{ id: number; nomComplet: string; poste: string }[]> {
        const agents = await this.agentRepository.find({
            relations: ['tickets'],
        });
    
        return agents.map(agent => ({
          id: agent.idAgent,
          nomComplet: `${agent.prenom} ${agent.nom}`,
          poste: agent.poste,
        }));
    }
    async getAllAgents(): Promise<Agent[]> {
        return this.agentRepository.find();
    }
}
