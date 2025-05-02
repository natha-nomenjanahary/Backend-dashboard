import { Injectable } from '@nestjs/common';
import { getPointByCategorie } from './categorie-points.util';

export interface Ticket {
    categorie: string;
    agentId: number;
    agentName: string;
}

interface ScoreParAgent {
    agentId: number;
    agentName: string;
    score: number;
}

export interface CompteurParAgent {
    agentId: number;
    agentName: string;
    nombreTickets: number;
  }

interface Agent {
    idAgent: number;
    nom: string;
    prenom: string;
}

@Injectable()
export class PerformanceService {
    calculerScoreParAgent(tickets: Ticket[]): ScoreParAgent[] {
        const scoreMap = new Map<number, ScoreParAgent>();
    
        for (const ticket of tickets) {
          const points = getPointByCategorie(ticket.categorie);
          if (!scoreMap.has(ticket.agentId)) {
            scoreMap.set(ticket.agentId, {
              agentId: ticket.agentId,
              agentName: ticket.agentName,
              score: 0,
            });
          }
          scoreMap.get(ticket.agentId)!.score += points;
        }
    
        return Array.from(scoreMap.values());
    }

    getNombreTicketsParAgent(agents: Agent[], tickets: Ticket[]): CompteurParAgent[] {
        const compteurMap = new Map<number, CompteurParAgent>();
    
        agents.forEach(agent => {
          if (!compteurMap.has(agent.idAgent)) {
            compteurMap.set(agent.idAgent, {
              agentId: agent.idAgent,
              agentName: agent.nom,
              nombreTickets: 0,
            });
          }
        });
      
        // Comptage des tickets par agent
        tickets.forEach(ticket => {
          if (compteurMap.has(ticket.agentId)) {
            compteurMap.get(ticket.agentId)!.nombreTickets += 1;
          }
        });
      
        return Array.from(compteurMap.values());
      }

    getNombreTicketsParAgentAvecTous(
        agents: Agent[],
        tickets: Ticket[],
      ): CompteurParAgent[] {
        const compteurMap = new Map<number, CompteurParAgent>();
    
        for (const agent of agents) {
          compteurMap.set(agent.idAgent, {
            agentId: agent.idAgent,
            agentName: `${agent.prenom} ${agent.nom}`,
            nombreTickets: 0,
          });
        }
    
        for (const ticket of tickets) {
          if (compteurMap.has(ticket.agentId)) {
            compteurMap.get(ticket.agentId)!.nombreTickets += 1;
          }
        }
    
        return Array.from(compteurMap.values());
      }  
}
