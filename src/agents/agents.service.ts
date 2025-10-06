import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Agent } from './entities/Agent.entity';
import { AgentStats } from './interfaces/agent-stats.interface';
import { calculerHeuresOuvrees } from '../performance/utils';
import { SousCategorieService } from '../sous-categories/sous-categories.service';

@Injectable()
export class AgentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    private readonly sousCategorieService: SousCategorieService, // <-- injection correcte
  ) {}

  // 1. Liste des agents avec statistique
  async getAgentsWithTicketStats(
    mois?: number,
    annee?: number
  ): Promise<AgentStats[]> {
    const today = new Date();
    const targetMois = mois ?? today.getMonth() + 1;
    const targetAnnee = annee ?? today.getFullYear();
  
    const startDate = new Date(targetAnnee, targetMois - 1, 1);
    const endDate =
      targetMois === today.getMonth() + 1 && targetAnnee === today.getFullYear()
        ? new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
        : new Date(targetAnnee, targetMois, 0, 23, 59, 59);
  
    const ID_ETAT_RESOLU = 3;
    const ID_ETAT_NON_ATTRIBUE = 5;
  
    // 🔹 Récupérer tous les agents avec leurs tickets (sans filtrage date)
    const agents = await this.agentRepository
      .createQueryBuilder('agent')
      .leftJoinAndSelect('agent.tickets', 'ticket')
      .getMany();
  
    // 🔹 Nombre total de tickets créés dans le mois pour tous les agents
    const totalTicketsMois = await this.dataSource
      .getRepository('Ticket')
      .createQueryBuilder('ticket')
      .where('ticket.dateCreation BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getCount();
  
    const results: AgentStats[] = [];
  
    for (const agent of agents) {
      const tickets = agent.tickets || [];
  
      // 🔹 Tickets attribués créés dans le mois
      const ticketsAttribues = tickets.filter(
        t =>
          Number(t.statut) !== ID_ETAT_NON_ATTRIBUE &&
          t.dateCreation >= startDate &&
          t.dateCreation <= endDate
      );
      const totalAssignes = ticketsAttribues.length;
  
      // 🔹 Tickets résolus dans le mois et créés dans le mois
      const resolus = ticketsAttribues.filter(
        t =>
          Number(t.statut) === ID_ETAT_RESOLU &&
          t.dateResolution &&
          t.dateResolution >= startDate &&
          t.dateResolution <= endDate
      );
      const totalResolus = resolus.length;
      const tauxRealisation = totalAssignes > 0 ? totalResolus / totalAssignes : 0;
  
      // 🔹 Résolution rapide avec complexité et heures ouvrées
      let resolusRapidesCount = 0;
      for (const t of resolus) {
        if (!t.sousCategorie || !t.dateCreation || !t.dateResolution) continue;
        const points = await this.sousCategorieService.getPointsByName(t.sousCategorie.nom);
        const heuresOuvrees = await calculerHeuresOuvrees(
          new Date(t.dateCreation),
          new Date(t.dateResolution)
        );
  
        if (
          (points === 10 && heuresOuvrees <= 6) ||
          (points === 20 && heuresOuvrees <= 18) ||
          (points === 30 && heuresOuvrees <= 24)
        ) {
          resolusRapidesCount++;
        }
      }
  
      const tauxResolutionRapide = totalResolus > 0 ? resolusRapidesCount / totalResolus : 0;
      const volumeTraite = totalResolus;
  
      const score =
        tauxRealisation * 0.5 + tauxResolutionRapide * 0.4 + (volumeTraite / 100) * 0.1;
  
      results.push({
        id: agent.idAgent,
        nom: `${agent.prenom} ${agent.nom}`,
        poste: agent.poste,
        ticketsRepartis: `${totalAssignes}/${totalTicketsMois}`,
        performance: Math.round(score * 5),
      });
    }
  
    return results;
  }
  
  // 2. Info sur un agent
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
      throw new Error("L'ID de l’agent est requis");
    }

    const today = new Date();
    const targetMois = mois ?? today.getMonth() + 1;
    const targetAnnee = annee ?? today.getFullYear();

    const startDate = new Date(targetAnnee, targetMois - 1, 1);
    const isMoisActuel =
      targetMois === today.getMonth() + 1 && targetAnnee === today.getFullYear();
    const endDate = isMoisActuel
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
      : new Date(targetAnnee, targetMois, 0, 23, 59, 59);

    const ID_ETAT_RESOLU = 3;
    const ID_ETAT_NON_ATTRIBUE = 5;

    // ⚡ Charger uniquement l’agent + ses tickets du mois
    const agent = await this.agentRepository
      .createQueryBuilder('agent')
      .leftJoinAndSelect(
        'agent.tickets',
        'ticket',
        'ticket.dateCreation BETWEEN :startDate AND :endDate',
        { startDate, endDate }
      )
      .where('agent.idAgent = :idAgent', { idAgent })
      .getOne();

    if (!agent) {
      throw new Error(`Aucun agent trouvé avec l'ID : ${idAgent}`);
    }

    const tickets = agent.tickets || [];

    const totalAssignes = tickets.filter(
      (t) => Number(t.statut) !== ID_ETAT_NON_ATTRIBUE
    ).length;

    const resolus = tickets.filter(
      (t) =>
        Number(t.statut) === ID_ETAT_RESOLU &&
        t.dateResolution &&
        new Date(t.dateResolution) >= startDate &&
        new Date(t.dateResolution) <= endDate
    );
    const totalResolus = resolus.length;

    const tauxRealisation = totalAssignes > 0 ? totalResolus / totalAssignes : 0;

    let resolusRapidesCount = 0;
      for (const t of resolus) {
        if (!t.sousCategorie || !t.dateCreation || !t.dateResolution) continue;
        const points = await this.sousCategorieService.getPointsByName(t.sousCategorie.nom);
        const heuresOuvrees = await calculerHeuresOuvrees(
          new Date(t.dateCreation),
          new Date(t.dateResolution)
        );

        if ((points === 10 && heuresOuvrees <= 6) ||
            (points === 20 && heuresOuvrees <= 18) ||
            (points === 30 && heuresOuvrees <= 24)) {
          resolusRapidesCount++;
        }
      }

      const tauxResolutionRapide = totalResolus > 0 ? resolusRapidesCount / totalResolus : 0;
      const volumeTraite = totalResolus;

      const score =
        tauxRealisation * 0.5 +
        tauxResolutionRapide * 0.4 +
        (volumeTraite / 100) * 0.1;


    return {
      score: Math.round(score * 5),
      id: agent.idAgent,
      nom: agent.nom,
      prenom: agent.prenom,
      poste: agent.poste,
      contact: Number(agent.tel),
      email: agent.email,
    };
  }

  // Utiliser dans performance
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
