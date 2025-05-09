import { Injectable } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';
import { TicketsService } from '../tickets/tickets.service';
import { SousCategorieService } from '../sous-categories/sous-categories.service';

export interface Ticket {
  sousCategorie: { libelle: string }; // Modifié pour correspondre à l'objet attendu
  agent: {
    idAgent: number;
    nom: string;
    prenom: string;
  };
}

interface ScoreParAgent {
  agentId: number;
  agentName: string;
  score: number;
}

export interface CompteurParAgent {
  agentId: number;
  agentName: string;
  ticketsResolus: number;
}

interface Agent {
  idAgent: number;
  nom: string;
  prenom: string;
}

@Injectable()
export class PerformanceService {
  constructor(
    private readonly sousCategorieService: SousCategorieService,
    private readonly agentService: AgentsService,
    private readonly ticketService: TicketsService,
  ) {}

  // 1. Score dépend de la complexité pour tous les agents
  async calculerScoreParAgent(tickets: Ticket[]): Promise<ScoreParAgent[]> {
    const scoreMap = new Map<number, { nom: string; score: number }>();

    for (const ticket of tickets) {
      const agentId = ticket.agent?.idAgent;
      const nomAgent = `${ticket.agent?.nom} ${ticket.agent?.prenom}`.trim();
      const sousCategorieLibelle = ticket.sousCategorie?.libelle;

      if (!agentId || !sousCategorieLibelle) continue;

      const normalizedName = sousCategorieLibelle.trim().toLowerCase();
      const points = await this.sousCategorieService.getPointsByName(normalizedName);

      const current = scoreMap.get(agentId);

      if (current) {
        scoreMap.set(agentId, {
          nom: current.nom,
          score: current.score + points,
        });
      } else {
        scoreMap.set(agentId, {
          nom: nomAgent,
          score: points,
        });
      }
    }

    return Array.from(scoreMap.entries()).map(([id, { nom, score }]) => ({
      agentId: id,
      agentName: nom,
      score,
    }));
  }

  // 2. Répartition par mois en pourcentage
  async getRepartitionTicketsParAgentParMois(
    mois: number = new Date().getMonth() + 1,
    annee: number = new Date().getFullYear(),
  ): Promise<
    {
      agentId: number;
      agentName: string;
      nombre: number;
      pourcentage: number;
    }[]
  > {
    const today = new Date();
    const startDate = new Date(annee, mois - 1, 1);
    const isMoisActuel = mois === today.getMonth() + 1 && annee === today.getFullYear();

    const endDate = isMoisActuel
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 23, 59, 59)
      : new Date(annee, mois, 0, 23, 59, 59);

    const agents = await this.agentService.getAllAgents();
    const tickets = await this.ticketService.getTicketsDesAgentsDansIntervalle(startDate, endDate);

    const countMap = new Map<number, number>();

    for (const ticket of tickets) {
      const agentId = ticket.agentId;
      if (agentId) {
        countMap.set(agentId, (countMap.get(agentId) || 0) + 1);
      }
    }

    const totalTickets = tickets.length;

    const repartition = agents
      .filter(agent => countMap.has(agent.idAgent))
      .map(agent => {
        const nombre = countMap.get(agent.idAgent)!;
        const pourcentage = parseFloat(((nombre / totalTickets) * 100).toFixed(2));

        return {
          agentId: agent.idAgent,
          agentName: `${agent.nom} ${agent.prenom}`,
          nombre,
          pourcentage,
        };
      });

    return repartition;
  }
}
