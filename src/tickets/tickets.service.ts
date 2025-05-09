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

  // 1. Liaison avec Score (performance)
  async getTicketsAvecAgents(): Promise<TicketWithAgent[]> {
    const rows = await this.dataSource.query(`
      SELECT
        i.id AS idTicket,
        i.date_create AS date_create,
        i.state AS state,
        c.name AS categorie,
        i.technician AS agentId,
        CONCAT(u.firstname, ' ', u.lastname) AS agentName
      FROM tincidents i
      LEFT JOIN tcategory c ON i.category = c.id
      LEFT JOIN tusers u ON i.technician = u.id
      WHERE i.technician IS NOT NULL
    `);
  
    return rows;
  }
  

  // 2. Tickets réalisés
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
  
    
    const countMap = new Map<number, { agentName: string, total: number }>();
  
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
  
    //  Retourner la structure demandée
    return Array.from(countMap.entries()).map(([agentId, { agentName, total }]) => ({
      agentId,
      agentName,
      total,
    }));
  }
  

  // 3. Statut des tickets par jour
  async getStatutTicketsParJourExcluantWeekends(month?: number, year?: number) {
    let startDate: Date;
    let endDate: Date;
  
    if (!month || !year || month < 1 || month > 12) {
      const today = new Date();
      const day = today.getDate();
  
      // Date de début : jour actuel du mois précédent
      startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 1);
  
      // Correction pour les mois courts (évite les dépassements genre 31 février)
      if (startDate.getDate() !== day) {
        startDate.setDate(0); // dernier jour du mois précédent
      }
  
      // Date de fin : la veille du jour actuel
      endDate = new Date(today);
      endDate.setDate(day - 1);
    } else {
      // Cas normal : mois et année valides fournis
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0);
    }
  
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('startDate ou endDate est invalide');
    }
  
    // week-end exclus
    const dates: Date[] = [];
    for (
      let currentDate = new Date(startDate);
      currentDate <= endDate;
      currentDate.setDate(currentDate.getDate() + 1)
    ) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 1 && dayOfWeek !== 0) {
        dates.push(new Date(currentDate)); // ← ici, une copie du jour en cours
      }
    }
    
  
    // Requête des tickets groupés par jour
    const ticketsStats = await this.ticketRepository
      .createQueryBuilder('ticket')
      .select('DATE(ticket.date_create)', 'date')
      .addSelect([
        `SUM(CASE WHEN ticket.state = 4 THEN 1 ELSE 0 END) AS nbFermes`,
        `SUM(CASE WHEN ticket.state = 1 THEN 1 ELSE 0 END) AS nbOuverts`,
        `SUM(CASE WHEN ticket.state = 2 THEN 1 ELSE 0 END) AS nbEnCours`,
      ])
      .where('ticket.date_create >= :startDate', { startDate: startDate.toISOString() })
      .andWhere('ticket.date_create <= :endDate', { endDate: endDate.toISOString() })
      .groupBy('DATE(ticket.date_create)')
      .getRawMany();
  
    // Formatter les résultats
    const result = dates.map(date => {
      const formattedDate = date.toISOString().split('T')[0];
      const statsForDay = ticketsStats.find(stat => {
        const statDateStr = new Date(stat.date).toISOString().split('T')[0];
        return statDateStr === formattedDate;
      });
  
      return {
        date: formattedDate,
        nbFermes: statsForDay ? Number(statsForDay.nbFermes) : 0,
        nbOuverts: statsForDay ? Number(statsForDay.nbOuverts) : 0,
        nbEnCours: statsForDay ? Number(statsForDay.nbEnCours) : 0,
      };
    });
  
    return result;
  }
  
  //4. Statut des tickets par agent
  async getStatutTicketsParAgent(query?: DateQueryDto) {
    let startDate: Date;
    let endDate: Date;
  
    if (query?.mois && query?.annee) {
      const moisIndex = query.mois - 1;
      startDate = new Date(query.annee, moisIndex, 1);
      endDate = new Date(query.annee, query.mois, 0);
    } else {
      const today = new Date();
      const jour = today.getDate();
      const mois = today.getMonth();
      const annee = today.getFullYear();
  
      startDate = mois === 0
        ? new Date(annee - 1, 11, jour)
        : new Date(annee, mois - 1, jour);
      endDate = new Date(annee, mois, jour - 1);
    }
  
    const stats = await this.agentRepository
      .createQueryBuilder('agent')
      .leftJoin('agent.tickets', 'ticket', 'ticket.dateCreation BETWEEN :start AND :end', {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      })
      .select('agent.prenom', 'prenom')
      .addSelect('agent.nom', 'nom')
      .addSelect(`SUM(CASE WHEN ticket.statut = 4 THEN 1 ELSE 0 END)`, 'nbFermes')
      .addSelect(`SUM(CASE WHEN ticket.statut = 1 THEN 1 ELSE 0 END)`, 'nbOuverts')
      .addSelect(`SUM(CASE WHEN ticket.statut = 2 THEN 1 ELSE 0 END)`, 'nbEnCours')
      .addSelect(`COUNT(ticket.idTicket)`, 'total')
      .groupBy('agent.idAgent')
      .getRawMany();
  
    return stats.map(agent => ({
      nomComplet: `${agent.prenom} ${agent.nom}`,
      nbFermes: Number(agent.nbFermes),
      nbOuverts: Number(agent.nbOuverts),
      nbEnCours: Number(agent.nbEnCours),
      total: Number(agent.total),
    }));
  }
  
  //5. evolution de nbre de tickets pour les 5dernier mois
  async getTicketsRepartisParMois(mois?: number, annee?: number) {
    const baseDate = mois && annee
      ? new Date(annee, mois - 1, 1)
      : new Date(); 
  
    // Création de la liste des 5 mois précédents
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
  
  //6. regroupe les tickets dans un intervalle
  async getTicketsDesAgentsDansIntervalle(startDate: Date, endDate: Date): Promise<TicketWithAgent[]> {
    return this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoin('ticket.agent', 'agent')
      .select([
        'ticket.idTicket AS idTicket',
        'ticket.date_create AS date_create',
        'ticket.state AS state',
        'agent.idAgent AS agentId',
        "CONCAT(agent.nom, ' ', agent.prenom) AS agentName",
      ])
      .where('ticket.date_create BETWEEN :start AND :end', {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      })
      .getRawMany();
  }
  
  
  
  
  
}
