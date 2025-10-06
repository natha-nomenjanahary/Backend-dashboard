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
  async getTicketsRealisesParAgent(
    mois?: number,
    annee?: number,
  ): Promise<{ agentId: number; agentName: string; total: number }[]> {
    const today = new Date();
    const targetMois = mois ?? today.getMonth() + 1;
    const targetAnnee = annee ?? today.getFullYear();
  
    const startDate = new Date(targetAnnee, targetMois - 1, 1);
  
    const isMoisActuel =
      targetMois === today.getMonth() + 1 && targetAnnee === today.getFullYear();
  
    const endDate = isMoisActuel
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 23, 59, 59)
      : new Date(targetAnnee, targetMois, 0, 23, 59, 59);
  
    // 🔹 Requête conforme à ton entity Ticket et ta table tincidents
    const tickets = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoin('ticket.technicien', 'technicien')
      .where('ticket.dateResolution BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('ticket.statut = :state', { state: 3 })
      .andWhere('ticket.technicien IS NOT NULL')
      .select([
        'ticket.idTicket AS idTicket',
        'ticket.statut AS state',
        'technicien.idAgent AS agentId',
        "CONCAT(technicien.nom, ' ', technicien.prenom) AS agentName",
      ])
      .getRawMany();
  
    const agents = await this.agentRepository.find();
    const countMap = new Map<number, { agentName: string; total: number }>();
  
    // Initialisation de chaque agent à 0 ticket
    for (const agent of agents) {
      const nom = `${agent.nom} ${agent.prenom}`.trim();
      countMap.set(agent.idAgent, { agentName: nom, total: 0 });
    }
  
    // Comptage des tickets réalisés par agent
    for (const ticket of tickets) {
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
  
    // Formatage du retour
    return Array.from(countMap.entries()).map(([agentId, { agentName, total }]) => ({
      agentId,
      agentName,
      total,
    }));
  }
  
  // 2. Statut des tickets par jour
  async getStatutTicketsParJourExcluantWeekends(month?: number, year?: number) {
    // --- 1) calcul des bornes startDate / endDate (avec heures locales)
    let startDate: Date;
    let endDate: Date;
  
    if (!month || !year || month < 1 || month > 12) {
      const today = new Date();
      const day = today.getDate();
  
      // start = même jour le mois précédent (capé au dernier jour du mois précédent si nécessaire)
      const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const daysInPrevMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate();
      const startDay = Math.min(day, daysInPrevMonth);
      startDate = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), startDay, 0, 0, 0, 0);
  
      // end = hier (local)
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    } else {
      // mois/année fournis => tout le mois (local)
      startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    }
  
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('startDate ou endDate est invalide');
    }
  
    // --- 2) Récupérer la liste des jours ouvrés
    const dates: Date[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dates.push(new Date(d)); // copie
      }
    }
  
    // helper format YYYY-MM-DD local pour comparaison fiable
    const toYMD = (dt: Date) => {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };
  
    // --- 3) Requête agrégée : on considère seulement les tickets créés ET résolus dans le mois donné
    const ticketsStats = await this.ticketRepository
      .createQueryBuilder('ticket')
      .select('DATE(ticket.date_res)', 'date')
      .addSelect(`SUM(CASE WHEN ticket.state = 1 THEN 1 ELSE 0 END)`, 'nbFermes')
      .addSelect(`SUM(CASE WHEN ticket.state = 2 THEN 1 ELSE 0 END)`, 'nbEnCours')
      .addSelect(`SUM(CASE WHEN ticket.state = 3 THEN 1 ELSE 0 END)`, 'nbResolus')
      .where('ticket.date_create >= :startDate AND ticket.date_create <= :endDate', { startDate, endDate })
      .andWhere('ticket.date_res >= :startDate AND ticket.date_res <= :endDate', { startDate, endDate })
      .andWhere('ticket.technician IS NOT NULL')
      .groupBy('DATE(ticket.date_res)')
      .orderBy('DATE(ticket.date_res)', 'ASC')
      .getRawMany();
  
    // --- 4) Totaux globaux
    let totalFermes = 0;
    let totalEnCours = 0;
    let totalResolus = 0;
  
    for (const stat of ticketsStats) {
      totalFermes += Number(stat.nbFermes || 0);
      totalEnCours += Number(stat.nbEnCours || 0);
      totalResolus += Number(stat.nbResolus || 0);
    }
  
    const totalTickets = totalFermes + totalEnCours + totalResolus;
  
    // --- 5) Construire parJour : on compare en YYYY-MM-DD local
    const result = dates.map(date => {
      const dayKey = toYMD(date);
  
      const statsForDay = ticketsStats.find(stat => {
        const statDate = new Date(stat.date);
        return toYMD(statDate) === dayKey;
      });
  
      if (!statsForDay) {
        return {
          date: dayKey,
          nbFermes: 0,
          nbEnCours: 0,
          nbResolus: 0,
        };
      }
  
      const nbFermes = Number(statsForDay.nbFermes || 0);
      const nbEnCours = Number(statsForDay.nbEnCours || 0);
      const nbResolus = Number(statsForDay.nbResolus || 0);
  
      return {
        date: dayKey,
        nbFermes,
        nbEnCours,
        nbResolus,
      };
    });
  
    // --- 6) Retour final
    return {
      resumeGlobal: {
        totalFermes,
        totalEnCours,
        totalResolus,
        totalTickets,
      },
      parJour: result,
    };
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
      .addSelect('SUM(CASE WHEN ticket.statut IN (4,5,6) THEN 1 ELSE 0 END)', 'autres')
      .addSelect('COUNT(ticket.idTicket)', 'total')
      .groupBy('agent.idAgent')
      .getRawMany();
    
    
  
    return stats.map(agent => ({
      nomComplet: `${agent.prenom} ${agent.nom}`,
      nbFermes: Number(agent.nbFermes),
      nbEnCours: Number(agent.nbEnCours),
      nbResolus: Number(agent.nbResolus),
      autres : Number(agent.autres),
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
