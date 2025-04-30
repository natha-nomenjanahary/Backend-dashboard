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

    getNombreTicketsParAgent(tickets: Ticket[]): CompteurParAgent[] {
        const compteurMap = new Map<number, CompteurParAgent>();
    
        for (const ticket of tickets) {
          if (!compteurMap.has(ticket.agentId)) {
            compteurMap.set(ticket.agentId, {
              agentId: ticket.agentId,
              agentName: ticket.agentName,
              nombreTickets: 0,
            });
          }
          compteurMap.get(ticket.agentId)!.nombreTickets += 1;
        }
    
        return Array.from(compteurMap.values());
      }
}
