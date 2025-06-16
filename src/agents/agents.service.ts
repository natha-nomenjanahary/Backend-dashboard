import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Agent } from './entities/Agent.entity';
import { AgentStats } from './interfaces/agent-stats.interface';

@Injectable()
export class AgentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
  ) {}

  //1.liste des agents avec statistique
  async getAgentsWithTicketStats(
    mois?: number,
    annee?: number
  ): Promise<AgentStats[]> {
    const today = new Date();
    const targetMois = mois ?? today.getMonth() + 1;
    const targetAnnee = annee ?? today.getFullYear();
  
    const startDate = new Date(targetAnnee, targetMois - 1, 1);
    const isMoisActuel = targetMois === today.getMonth() + 1 && targetAnnee === today.getFullYear();
    const endDate = isMoisActuel
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
      : new Date(targetAnnee, targetMois, 0, 23, 59, 59);
  
    const ID_ETAT_RESOLU = 3; // "Résolu"
    const ID_ETAT_NON_ATTRIBUE = 5;
  
    const agents = await this.agentRepository.find({ relations: ['tickets'] });
  
    return agents.map(agent => {
      
      const tickets = (agent.tickets || []).filter(ticket => {
        if (!ticket.dateCreation) return false;
        const creation = new Date(ticket.dateCreation);
        return creation >= startDate && creation <= endDate;
      });
    
      const totalAssignes = tickets.filter(t => Number(t.statut) !== ID_ETAT_NON_ATTRIBUE).length;
    
      
      const resolus = tickets.filter(t =>
        Number(t.statut) === ID_ETAT_RESOLU &&
        t.dateResolution &&
        new Date(t.dateResolution) >= startDate &&
        new Date(t.dateResolution) <= endDate
      );
      const totalResolus = resolus.length;
    
      const tauxRealisation = totalAssignes > 0 ? totalResolus / totalAssignes : 0;
    
      const resolusRapides = resolus.filter(t =>
        t.dateCreation &&
        (new Date(t.dateResolution).getTime() - new Date(t.dateCreation).getTime()) / (1000 * 3600 * 24) <= 2
      );
    
      const tauxResolutionRapide = totalResolus > 0 ? resolusRapides.length / totalResolus : 0;
      const volumeTraite = totalResolus;
    
      const score =
        tauxRealisation * 0.5 +
        tauxResolutionRapide * 0.4 +
        (volumeTraite / 100) * 0.1;
    
      return {
        id: agent.idAgent,
        nom: `${agent.prenom} ${agent.nom}`,
        poste: agent.poste,
        ticketsResolus: `${totalResolus}/${totalAssignes}`,
        performance: Math.round(score * 5),
      };
    });
  }

  //2.Info sur un agent
  async getInfoAgentParId(
    idAgent: number,
    mois?: number,
    annee?: number
  ): Promise<{
    score: number;
    id: number;
    nom: string;
    prenom: string;
    poste: string;
    contact: number;
    email: string;
  }> {
    if (!idAgent) {
      throw new Error('L\'ID de l’agent est requis');
    }
  
    const today = new Date();
    const targetMois = mois ?? today.getMonth() + 1;
    const targetAnnee = annee ?? today.getFullYear();
  
    const startDate = new Date(targetAnnee, targetMois - 1, 1);
    const isMoisActuel = targetMois === today.getMonth() + 1 && targetAnnee === today.getFullYear();
    const endDate = isMoisActuel
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
      : new Date(targetAnnee, targetMois, 0, 23, 59, 59);
  
    const ID_ETAT_RESOLU = 3;
    const ID_ETAT_NON_ATTRIBUE = 5;
  
    const agent = await this.agentRepository.findOne({
      relations: ['tickets'],
      where: { idAgent: idAgent }
    });
  
    if (!agent) {
      throw new Error(`Aucun agent trouvé avec l'ID : ${idAgent}`);
    }
  
    const tickets = (agent.tickets || []).filter(ticket => {
      if (!ticket.dateCreation) return false;
      const creation = new Date(ticket.dateCreation);
      return creation >= startDate && creation <= endDate;
    });
  
    const totalAssignes = tickets.filter(t => Number(t.statut) !== ID_ETAT_NON_ATTRIBUE).length;
  
    const resolus = tickets.filter(t =>
      Number(t.statut) === ID_ETAT_RESOLU &&
      t.dateResolution &&
      new Date(t.dateResolution) >= startDate &&
      new Date(t.dateResolution) <= endDate
    );
    const totalResolus = resolus.length;
  
    const tauxRealisation = totalAssignes > 0 ? totalResolus / totalAssignes : 0;
  
    const resolusRapides = resolus.filter(t =>
      t.dateCreation &&
      (new Date(t.dateResolution).getTime() - new Date(t.dateCreation).getTime()) / (1000 * 3600 * 24) <= 1
    );
  
    const tauxResolutionRapide = totalResolus > 0 ? resolusRapides.length / totalResolus : 0;
    const volumeTraite = totalResolus;
  
    const score =
      tauxRealisation * 0.5 +
      tauxResolutionRapide * 0.3 +
      (volumeTraite / 100) * 0.2;
  
    return {
      score: Math.round(score * 5),
      id: agent.idAgent,
      nom: agent.nom,
      prenom: agent.prenom,
      poste: agent.poste,
      contact: Number(agent.tel),
      email: agent.email
    };
  }
  
  //Utiliser dans performance
  async getAllAgents(): Promise<Agent[]> {
    return this.agentRepository.find();
  }
  async getAgentByPrenomEtNom(prenom: string, nom: string): Promise<Agent | null> {
    return this.agentRepository.findOne({
      where: { prenom, nom },
    });
  }
  async getInfoAgentParNomOuPrenom(terme: string): Promise<Agent | null> {
    const termeFormate = `%${terme.toLowerCase()}%`;
  
    return this.agentRepository
      .createQueryBuilder('agent')
      .where('LOWER(agent.lastname) LIKE :terme', { terme: termeFormate })
      .orWhere('LOWER(agent.firstname) LIKE :terme', { terme: termeFormate })
      .getOne();
  }
  
}
