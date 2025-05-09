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


  //Liste des agents 
  async getAgentsWithTicketStats(
    mois?: number, 
    annee?: number
  ): Promise<AgentStats[]> {
    const today = new Date();
    const targetMois = mois ?? today.getMonth() + 1;
    const targetAnnee = annee ?? today.getFullYear();
  
    // Définir la date de début : le 1er jour du mois ciblé
    const startDate = new Date(targetAnnee, targetMois - 1, 1);
    
    // Si le mois est en cours, la date de fin sera hier à 23h59
    const isMoisActuel =
      targetMois === today.getMonth() + 1 && targetAnnee === today.getFullYear();
    const endDate = isMoisActuel
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 23, 59, 59)
      : new Date(targetAnnee, targetMois, 0, 23, 59, 59); // fin du mois
  
    // Récupérer les agents avec leurs tickets
    const agents = await this.agentRepository.find({
      relations: ['tickets'],
    });
  
    const ID_ETAT_RESOLU = 6;
  
    return agents.map(agent => {
      // Filtrer les tickets selon la période définie
      const tickets = (agent.tickets || []).filter(ticket => {
        const creationDate = new Date(ticket.dateCreation);
        return creationDate >= startDate && creationDate <= endDate;
      });
  
      const totalAssignes = tickets.length;
  
      // Tickets résolus
      const resolus = tickets.filter(t => t.statut === String(ID_ETAT_RESOLU));
      const totalResolus = resolus.length;
  
      // Calcul du taux de réalisation
      const tauxRealisation = totalAssignes > 0 ? totalResolus / totalAssignes : 0;
  
      // Tickets résolus rapidement (moins de 2 jours)
      const resolusRapides = resolus.filter(t =>
        t.dateResolution && t.dateCreation &&
        (new Date(t.dateResolution).getTime() - new Date(t.dateCreation).getTime()) / (1000 * 3600 * 24) <= 2
      );
  
      const tauxResolutionRapide = totalResolus > 0 ? resolusRapides.length / totalResolus : 0;
  
      // Volume traité : nombre de tickets résolus
      const volumeTraite = totalResolus;
  
      // Score calculé en fonction des critères
      const score =
        tauxRealisation * 0.5 +                 // 50% de taux de réalisation
        tauxResolutionRapide * 0.4 +            // 40% de tickets résolus rapidement
        (volumeTraite / 100) * 0.1;             // 10% de volume traité
  
      // Retourner les statistiques de performance de chaque agent
      return {
        id: agent.idAgent,
        nom: `${agent.prenom} ${agent.nom}`,
        poste: agent.poste,
        ticketsResolus: `${totalResolus}/${totalAssignes}`, // Nombre de tickets résolus / total assignés
        performance: Math.round(score * 5), // Performance entre 0 et 5
      };
    });
  }
    

  async getAllAgents(): Promise<Agent[]> {
    return this.agentRepository.find();
  }
}
