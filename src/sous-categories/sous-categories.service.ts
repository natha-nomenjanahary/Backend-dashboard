import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../tickets/entities/Ticket.entity';
import { Agent } from '../agents/entities/Agent.entity';
import { TicketsService } from '../tickets/tickets.service';

export interface ScoreParAgent {
  agentId: number;
  agentName: string;
  score: number;
}

@Injectable()
export class SousCategorieService {
  constructor(
    private readonly ticketService: TicketsService,    

    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,

    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    
  ) {}

  async getPointsByName(nom: string): Promise<number> {
    const normalized = this.normalizeSousCategorie(nom);
  
    const points10 = [
      'insertion rib',
      'insertion nifstat',
      'creation tiers',
      'import budget epnctd',
      'demande login',
      'export bord',
      'rejet mandat',
    ];
  
    const points20 = [
      'marche convention',
      'bordereau ticket',
      'caisse davance',
      'derogation',
      'engagement',
      'liquidation op regularisation',
      'modification code ordsec gac',
      'probleme login',
      'siigta',
      'ajout ligne de credit',
      'amenagement',
    ];
  
    const points30 = ['nominations', 'bcse'];
  
    if (points10.includes(normalized)) return 10;
    if (points20.includes(normalized)) return 20;
    if (points30.includes(normalized)) return 30;
  
    return 30; 
  }
  
  normalizeSousCategorie(sousCategorie: string | null | undefined): string {
    if (!sousCategorie) return 'inconnue';
    return sousCategorie
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') 
      .replace(/[^a-z0-9 ]/g, '')      
      .replace(/\s+/g, ' ')            
      .trim();
  }
  

  async calculerScoreParAgent(
    mois?: number,
    annee?: number,
  ): Promise<
    {
      agentId: number;
      agentName: string;
      moisActuel: number;
      moisDernier: number;
    }[]
  > {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
  
    const selectedYear = annee ?? currentYear;
    const selectedMonth = mois ?? currentMonth;
  
    
    const startDateActuel = new Date(selectedYear, selectedMonth - 1, 1);
    const endDateActuel =
      selectedYear === currentYear && selectedMonth === currentMonth
        ? new Date(selectedYear, selectedMonth - 1, now.getDate() - 1)
        : new Date(selectedYear, selectedMonth, 0);
  
    
    const moisDernier = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const anneeDernier = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    const startDateDernier = new Date(anneeDernier, moisDernier - 1, 1);
    const endDateDernier = new Date(anneeDernier, moisDernier, 0);
  
    
    const [ticketsActuel, ticketsDernier] = await Promise.all([
      this.ticketService.getTicketsDesAgentsDansIntervalle(startDateActuel, endDateActuel),
      this.ticketService.getTicketsDesAgentsDansIntervalle(startDateDernier, endDateDernier),
    ]);
  
    const ticketsRealisesActuel = ticketsActuel.filter(t => t.state === 3);
    const ticketsRealisesDernier = ticketsDernier.filter(t => t.state === 3);
  
    const agents = await this.agentRepository.find();
  
    const scoreMap = new Map<number, { nom: string; moisActuel: number; moisDernier: number }>();
  
    for (const agent of agents) {
      const nom = `${agent.nom} ${agent.prenom}`.trim();
      scoreMap.set(agent.idAgent, { nom, moisActuel: 0, moisDernier: 0 });
    }
  
    // Calcule scores du mois actuel
    for (const ticket of ticketsRealisesActuel) {
      const agentId = ticket.agentId;
      const nomAgent = ticket.agentName;
      const sousCatNom = ticket.sousCategorieNom;
  
      if (!agentId || !sousCatNom) continue;
  
      const normalizedName = this.normalizeSousCategorie(sousCatNom);
      const points = await this.getPointsByName(normalizedName);
  
      const current = scoreMap.get(agentId);
      if (current) {
        current.nom ||= nomAgent || '';
        current.moisActuel += points;
      } else {
        scoreMap.set(agentId, {
          nom: nomAgent || '',
          moisActuel: points,
          moisDernier: 0,
        });
      }
    }
  
    for (const ticket of ticketsRealisesDernier) {
      const agentId = ticket.agentId;
      const nomAgent = ticket.agentName;
      const sousCatNom = ticket.sousCategorieNom;
  
      if (!agentId || !sousCatNom) continue;
  
      const normalizedName = this.normalizeSousCategorie(sousCatNom);
      const points = await this.getPointsByName(normalizedName);
  
      const current = scoreMap.get(agentId);
      if (current) {
        current.nom ||= nomAgent || '';
        current.moisDernier += points;
      } else {
        scoreMap.set(agentId, {
          nom: nomAgent || '',
          moisActuel: 0,
          moisDernier: points,
        });
      }
    }
  
    return Array.from(scoreMap.entries()).map(([agentId, { nom, moisActuel, moisDernier }]) => ({
      agentId,
      agentName: nom,
      moisActuel,
      moisDernier,
    }));
  }
  
  
}
