import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository  } from 'typeorm';
import { Ticket } from './entities/Ticket.entity';
import { DateQueryDto } from './dto/date-query.dto';
import { Agent } from '../agents/entities/Agent.entity'
import { TicketWithAgent } from '../performance/performance.controller';


@Injectable()
export class TicketsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(Agent)
  private agentRepository: Repository<Agent>,
  ) {}
  

  // 1. Tickets réalisés
  async getTicketsRealisesParAgent(mois?: number, annee?: number): Promise<{ agentId: number, agentName: string, total: number }[]> {
    const today = new Date();
    const targetMois = mois ?? today.getMonth() + 1;
    const targetAnnee = annee ?? today.getFullYear();
  
    const startDate = new Date(targetAnnee, targetMois - 1, 1);
  
    const isMoisActuel =
      targetMois === today.getMonth() + 1 &&
      targetAnnee === today.getFullYear();
  
    const endDate = isMoisActuel
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 23, 59, 59)
      : new Date(targetAnnee, targetMois, 0, 23, 59, 59);
  
    
    const tickets = await this.getTicketsDesAgentsDansIntervalle(startDate, endDate);
  
    const ID_STATE_RESOLU = 3;
  
    
    const realises = tickets.filter(ticket => ticket.state === ID_STATE_RESOLU);
  
    const agents = await this.agentRepository.find();
    const countMap = new Map<number, { agentName: string, total: number }>();
  
    for (const agent of agents) {
      const nom = `${agent.nom} ${agent.prenom}`.trim();
      countMap.set(agent.idAgent, { agentName: nom, total: 0 });
    }
    for (const ticket of realises) {
      const current = countMap.get(ticket.agentId);
      if (current) {
        current.total += 1;
      } else {
        countMap.set(ticket.agentId, {
          agentName: ticket.agentName,
          total: 1,
        });
      }
    }
    return Array.from(countMap.entries()).map(([agentId, { agentName, total }]) => ({
      agentId,
      agentName,
      total,
    }));
  }
  

  // 2. Statut des tickets par jour
  async getStatutTicketsParJourExcluantWeekends(month?: number, year?: number) {
    let startDate: Date;
    let endDate: Date;
  
    if (!month || !year || month < 1 || month > 12) {
      const today = new Date();
      const day = today.getDate();
  
      startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 1);
      startDate.setDate(day);
  
      endDate = new Date(today);
      endDate.setDate(day - 1);
    } else {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0);
    }
  
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('startDate ou endDate est invalide');
    }
  
    const dates: Date[] = [];
    for (
      let currentDate = new Date(startDate);
      currentDate <= endDate;
      currentDate.setDate(currentDate.getDate() + 1)
    ) {
      const dayOfWeek = currentDate.getDay(); 
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dates.push(new Date(currentDate));
      }
    }
  
    const formatDate = (date: Date): string =>
      date.toISOString().slice(0, 19).replace('T', ' ');
  
      const ticketsStats = await this.ticketRepository
        .createQueryBuilder('ticket')
        .select('DATE(ticket.date_create)', 'date')
        .addSelect([
          `SUM(CASE WHEN ticket.state = 1 THEN 1 ELSE 0 END) AS nbFermes`,
          `SUM(CASE WHEN ticket.state = 2 THEN 1 ELSE 0 END) AS nbEnCours`,
          `SUM(CASE WHEN ticket.state = 3 THEN 1 ELSE 0 END) AS nbResolus`,
        ])
        .where('ticket.date_create >= :startDate', { startDate: formatDate(startDate) })
        .andWhere('ticket.date_create <= :endDate', { endDate: formatDate(endDate) })
        .andWhere('ticket.technicien IS NOT NULL') 
        .groupBy('DATE(ticket.date_create)')
        .getRawMany();

        const result = dates.map(date => {
          const formattedDate = date.toLocaleDateString('fr-CA');
        
          const statsForDay = ticketsStats.find(stat => {
            const statDate = new Date(stat.date);
            const statFormattedDate = statDate.toLocaleDateString('fr-CA');
            return statFormattedDate === formattedDate;
          });
        
          if (!statsForDay) {
            return {
              date: formattedDate,
              nbFermes: 0,
              nbEnCours: 0,
              nbResolus: 0,
            };
          }
        
          const nbFermes = Number(statsForDay.nbFermes);
          const nbEnCours = Number(statsForDay.nbEnCours);
          const nbResolus = Number(statsForDay.nbResolus);
        
          const total = nbFermes + nbEnCours + nbResolus || 1;
        
          return {
            date: formattedDate,
            nbFermes: (nbFermes / total) * 100,
            nbEnCours: (nbEnCours / total) * 100,
            nbResolus: (nbResolus / total) * 100,
          };
        });
        
    
    return result;
  }
  
  
  //3. Statut des tickets par agent
  async getStatutTicketsParAgent(query?: DateQueryDto) {
    let startDate: Date;
    let endDate: Date;
  
    if (query?.mois && query?.annee) {
      const moisIndex = query.mois - 1;
  
      startDate = new Date(query.annee, moisIndex, 1);
      startDate.setHours(0, 0, 0, 0);
  
      endDate = new Date(query.annee, moisIndex + 1, 0);
      endDate.setHours(23, 59, 59, 999);
    } else {
      const today = new Date();
      const jour = today.getDate();
      const mois = today.getMonth();
      const annee = today.getFullYear();
  
      startDate = mois === 0
        ? new Date(annee - 1, 11, jour)
        : new Date(annee, mois - 1, jour);
      endDate = new Date(annee, mois, jour - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }
  
    const stats = await this.agentRepository
      .createQueryBuilder('agent')
      .leftJoin('agent.tickets', 'ticket', 'ticket.dateCreation BETWEEN :start AND :end', {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      })
      .select('agent.prenom', 'prenom')
      .addSelect('agent.nom', 'nom')
      .addSelect('SUM(CASE WHEN ticket.statut = 1 THEN 1 ELSE 0 END)', 'nbFermes')
      .addSelect('SUM(CASE WHEN ticket.statut = 2 THEN 1 ELSE 0 END)', 'nbEnCours')
      .addSelect('SUM(CASE WHEN ticket.statut = 3 THEN 1 ELSE 0 END)', 'nbResolus')
      .addSelect('COUNT(ticket.idTicket)', 'total')
      .groupBy('agent.idAgent')
      .getRawMany();
  
    return stats.map(agent => ({
      nomComplet: `${agent.prenom} ${agent.nom}`,
      nbFermes: Number(agent.nbFermes),
      nbEnCours: Number(agent.nbEnCours),
      nbResolus: Number(agent.nbResolus),
      total: Number(agent.total),
    }));
  }
  
  
  //4. evolution de nbre de tickets pour les 5dernier mois
  async getTicketsRepartisParMois(mois?: number, annee?: number) {
    const baseDate = mois && annee
      ? new Date(annee, mois - 1, 1)
      : new Date(); 
    const moisList: { mois: number; annee: number }[] = [];
    for (let i = 5; i >= 1; i--) {
      const date = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
      moisList.push({ mois: date.getMonth() + 1, annee: date.getFullYear() });
    }
  
    const startDate = new Date(
      moisList[0].annee,
      moisList[0].mois - 1,
      1
    );
    const endDate = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth() + 1,
      0
    );
  
    const rawStats = await this.ticketRepository
      .createQueryBuilder('ticket')
      .select("YEAR(ticket.date_create)", "annee")
      .addSelect("MONTH(ticket.date_create)", "mois")
      .addSelect("COUNT(ticket.idTicket)", "total")
      .where("ticket.date_create BETWEEN :start AND :end", {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      })
      .groupBy("YEAR(ticket.date_create)")
      .addGroupBy("MONTH(ticket.date_create)")
      .getRawMany();
  
    
    const results = moisList.map(({ mois, annee }) => {
      const match = rawStats.find(
        (stat) => stat.mois === mois && stat.annee === annee
      );
      return {
        mois: `${String(mois).padStart(2, '0')}/${annee}`,
        total: match ? Number(match.total) : 0,
      };
    });
  
    return results;
  }
  
  //5. regroupe les tickets dans un intervalle
  async getTicketsDesAgentsDansIntervalle(startDate: Date, endDate: Date): Promise<TicketWithAgent[]> {
    return this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoin('ticket.technicien', 'agent')
      .leftJoin('ticket.sousCategorie', 'souscat')
      .select([
        'ticket.idTicket AS idTicket',
        'ticket.date_create AS date_create',
        'ticket.state AS state',
        'agent.idAgent AS agentId',
        "CONCAT(agent.nom, ' ', agent.prenom) AS agentName",
        'souscat.name AS sousCategorieNom',
      ])
      .where('ticket.date_create BETWEEN :start AND :end', {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      })
      .getRawMany();
  }
  
  
  
  
  
}
