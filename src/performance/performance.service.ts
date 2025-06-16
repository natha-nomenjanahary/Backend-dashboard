import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';
import { TicketsService } from '../tickets/tickets.service';
import { SousCategorieService } from '../sous-categories/sous-categories.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Ticket } from '../tickets/entities/Ticket.entity';
import { Agent } from 'http';

@Injectable()
export class PerformanceService {
  constructor(
    private readonly sousCategorieService: SousCategorieService,
    private readonly agentService: AgentsService,
    private readonly ticketService: TicketsService,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    // @InjectRepository(Agent)
    // private readonly agentRepository: Repository<Agent>,
) {}

private msToHeureMinute(ms: number): string {
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const heures = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${heures}h${minutes.toString().padStart(2, '0')}`;
}


  // 1. Répartition par mois en pourcentage
  async getRepartitionTicketsParAgentParMois(
    mois?: number,
    annee?: number,
  ): Promise<
    {
      agentId: number;
      name: string;
      tickets: number;
      totalTickets: number;
      pourcentage: number;
    }[]
  > {
    const today = new Date();
    const targetMois = mois ?? today.getMonth() + 1;
    const targetAnnee = annee ?? today.getFullYear();

    const startDate = new Date(targetAnnee, targetMois - 1, 1);
    const isMoisActuel =
      targetMois === today.getMonth() + 1 &&
      targetAnnee === today.getFullYear();

    const endDate = isMoisActuel
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
      : new Date(targetAnnee, targetMois, 0, 23, 59, 59);

    const agents = await this.agentService.getAllAgents();

    const tickets = await this.ticketService.getTicketsDesAgentsDansIntervalle(startDate, endDate);

    const countMap = new Map<number, number>();

    for (const ticket of tickets) {
      const agentId = ticket.agentId;
      if (agentId) {
        countMap.set(agentId, (countMap.get(agentId) || 0) + 1);
      }
    }

    const totalTickets = tickets.length || 1;

    return agents.map(agent => {
      const count = countMap.get(agent.idAgent) || 0;
      const pourcentage = parseFloat(((count / totalTickets) * 100).toFixed(2));

      return {
        agentId: agent.idAgent,
        name: `${agent.nom} ${agent.prenom}`,
        tickets: count,
        totalTickets: totalTickets,
        pourcentage,
      };
    });
  }

  // 2. Taux de résolution des tickets par mois
  async calculerTauxResolutionMensuel(mois?: number, annee?: number): Promise<{
    totalTicketsRepartis: number;
    totalTicketsResolus: number;
    tauxResolution: number;
    repartition : {
      NbFacile: number;
      NbMoyen: number;
      NbDifficile: number;
    };
  }> {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
  
    const targetYear = annee ?? currentYear;
    const targetMonth = mois ?? currentMonth;
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    let endDate: Date;
    if (targetYear === currentYear && targetMonth === currentMonth) {
      endDate = new Date(targetYear, targetMonth - 1, today.getDate() - 1, 23, 59, 59, 999);
    } else {
      endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    }
  
    const tickets = await this.ticketRepository
      .createQueryBuilder('ticket')      
      .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie') 
      .where('ticket.date_create BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('ticket.technician IS NOT NULL')
      .getMany();
  
    const totalRepartis = tickets.length;
    const totalResolus = tickets.filter(t => t.statut === 3).length;
    const ticketsResolus = tickets.filter(t => t.statut === 3);
    const taux = totalRepartis > 0 ? parseFloat(((totalResolus / totalRepartis) * 100).toFixed(2)) : 0;
    
    const repartition = {
        NbFacile: 0,
        NbMoyen: 0,
        NbDifficile: 0,
      };
    
      for (const ticket of ticketsResolus) {
            const sousCategorieNom = ticket.sousCategorie?.nom;
            const points = await this.sousCategorieService.getPointsByName(sousCategorieNom);
            const pointsNum = Number(points);
            if (pointsNum === 10) repartition.NbFacile++;
            else if (pointsNum === 20) repartition.NbMoyen++;
            else if (pointsNum === 30) repartition.NbDifficile++;
      }
    const facile = totalResolus > 0 ? parseFloat(((repartition.NbFacile / totalResolus) * 5).toFixed(2)) : 0;
    const moyen = totalResolus > 0 ? parseFloat(((repartition.NbMoyen / totalResolus) * 5).toFixed(2)) : 0;
    const difficile = totalResolus > 0 ? parseFloat(((repartition.NbDifficile / totalResolus) * 5).toFixed(2)) : 0;
       

    return {
      totalTicketsRepartis: totalRepartis,
      totalTicketsResolus: totalResolus,
      tauxResolution: taux,
      repartition : {
        NbFacile: facile,
        NbMoyen: moyen,
        NbDifficile: difficile,
      }
    };
  }
  
  //3.Info sur ces tickets(F,M, D) par chaque agent
  async calculerResolutionParAgentParMois(mois?: number, annee?: number): Promise<
  {
    nom: string;
    ticketFacile: { nombre: number; point: number };
    ticketMoyen: { nombre: number; point: number };
    ticketDifficile: { nombre: number; point: number };
    totalPoint: number;
  }[]
  > {
    const today = new Date();
    const targetYear = annee ?? today.getFullYear();
    const targetMonth = mois ?? today.getMonth() + 1;

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999); 

    const ticketsResolus = await this.ticketRepository
      .createQueryBuilder('ticket')
      .where('ticket.state = :etatResolu', { etatResolu: 3 }) 
      .andWhere('ticket.technician IS NOT NULL')
      .andWhere('ticket.date_res BETWEEN :start AND :end', { start: startDate, end: endDate })
      .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie')
      .leftJoinAndSelect('ticket.technicien', 'technicien')
      .getMany();
    console.log('Tickets récupérés (ID et statut) :');
    const resultat = new Map<string, {
      nom: string;
      ticketFacile: { nombre: number; point: number };
      ticketMoyen: { nombre: number; point: number };
      ticketDifficile: { nombre: number; point: number };
      totalPoint: number;
    }>();

    const cachePoints = new Map<string, number>(); 

    for (const ticket of ticketsResolus) {
      const agent = ticket.technicien;
      const sousCategorie = ticket.sousCategorie;  
      if (!agent || !sousCategorie) continue;

      const nom = agent.prenom ;
      const libelle = sousCategorie.nom;

      let points: number;

      if (cachePoints.has(libelle)) {
        points = cachePoints.get(libelle)!;
      } else {
        points = await this.sousCategorieService.getPointsByName(libelle);
        cachePoints.set(libelle, points);
      }

      if (!resultat.has(nom)) {
        resultat.set(nom, {
          nom,
          ticketFacile: { nombre: 0, point: 0 },
          ticketMoyen: { nombre: 0, point: 0 },
          ticketDifficile: { nombre: 0, point: 0 },
          totalPoint: 0,
        });
      }

      const donnees = resultat.get(nom)!;

      if (points === 10) {
        donnees.ticketFacile.nombre++;
        donnees.ticketFacile.point += 10;
      } else if (points === 20) {
        donnees.ticketMoyen.nombre++;
        donnees.ticketMoyen.point += 20;
      } else if (points === 30) {
        donnees.ticketDifficile.nombre++;
        donnees.ticketDifficile.point += 30;
      }

      donnees.totalPoint += points;
    }

    return Array.from(resultat.values());
  }

  //4. Temps moyen de resolution des tickets FACILES
  async calculerTempsMoyenResolutionParComplexiteParAgent(
    mois?: number,
    annee?: number,
  ): Promise<{
    faciles: {
      agentId: number;
      nomAgent: string;
      nombreTickets: number;
      tempsMoyenHeures: number;
    }[];
    moyens: {
      agentId: number;
      nomAgent: string;
      nombreTickets: number;
      tempsMoyenHeures: number;
    }[];
    difficiles: {
      agentId: number;
      nomAgent: string;
      nombreTickets: number;
      tempsMoyenHeures: number;
    }[];
  }> {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
  
    const targetYear = annee ?? currentYear;
    const targetMonth = mois ?? currentMonth;
  
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate =
      targetYear === currentYear && targetMonth === currentMonth
        ? new Date(targetYear, targetMonth - 1, today.getDate() - 1, 23, 59, 59, 999)
        : new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
  
    const tickets = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.technicien', 'technicien')
      .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie')
      .where('ticket.state = :etatResolu', { etatResolu: 3 })
      .andWhere('ticket.date_res BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .getMany();
  
    const regroupement = {
      faciles: new Map<number, { agentId: number; nomAgent: string; totalTemps: number; nombreTickets: number }>(),
      moyens: new Map<number, { agentId: number; nomAgent: string; totalTemps: number; nombreTickets: number }>(),
      difficiles: new Map<number, { agentId: number; nomAgent: string; totalTemps: number; nombreTickets: number }>(),
    };
  
    for (const ticket of tickets) {
      const agent = ticket.technicien;
      const sousCategorie = ticket.sousCategorie;
      if (!agent || !sousCategorie) continue;
  
      const points = await this.sousCategorieService.getPointsByName(sousCategorie.nom);
      const dateDebut = new Date(ticket.dateCreation);
      const dateFin = new Date(ticket.dateResolution);
      const tempsResolutionHeures = (dateFin.getTime() - dateDebut.getTime()) / (1000 * 60 * 60);
  
      let map: Map<number, any> | null = null;
      if (points === 10) map = regroupement.faciles;
      else if (points === 20) map = regroupement.moyens;
      else if (points === 30) map = regroupement.difficiles;
      else continue;
  
      if (!map.has(agent.idAgent)) {
        map.set(agent.idAgent, {
          agentId: agent.idAgent,
          nomAgent: agent.prenom,
          totalTemps: 0,
          nombreTickets: 0,
        });
      }
  
      const donnees = map.get(agent.idAgent);
      donnees.totalTemps += tempsResolutionHeures;
      donnees.nombreTickets += 1;
    }
  
    const formatter = (map: Map<number, any>) =>
      Array.from(map.values()).map(d => ({
        agentId: d.agentId,
        nomAgent: d.nomAgent,
        nombreTickets: d.nombreTickets,
        tempsMoyenHeures: d.nombreTickets > 0 ? parseFloat((d.totalTemps / d.nombreTickets).toFixed(2)) : 0,
      }));
  
    return {
      faciles: formatter(regroupement.faciles),
      moyens: formatter(regroupement.moyens),
      difficiles: formatter(regroupement.difficiles),
    };
  }
  
  //7.Identification des periodes de forte activité
  async obtenirTicketsEnCoursDes10MoisPrecedents(mois?: number, annee?: number): Promise<
  {
    mois: string;
    ticketFacile: number;
    ticketMoyen: number;
    ticketDifficile: number;
    total: number;
  }[]
  >{
    const resultats: {
      mois: string;
      ticketFacile: number;
      ticketMoyen: number;
      ticketDifficile: number;
      total: number;
    }[] = [];

    const today = new Date();
    const currentMonth = mois ?? today.getMonth() + 1;
    const currentYear = annee ?? today.getFullYear();

    const moisFrancais = [
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];

    const cachePoints = new Map<string, number>();
    for (let i = 9; i >= 0; i--) {
      const dateRef = new Date(currentYear, currentMonth - 1 - i, 1);
      const moisRef = dateRef.getMonth(); // 0-11
      const anneeRef = dateRef.getFullYear();

      const debut = new Date(anneeRef, moisRef, 1);
      const fin = new Date(anneeRef, moisRef + 1, 0, 23, 59, 59, 999);

      const tickets = await this.ticketRepository
        .createQueryBuilder('ticket')
        .where('ticket.state = :state', { state: 2 }) // En cours
        .andWhere('ticket.date_create BETWEEN :start AND :end', { start: debut, end: fin })
        .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie')
        .getMany();

      let facile = 0, moyen = 0, difficile = 0;

      for (const ticket of tickets) {
        const sousCategorie = ticket.sousCategorie;
        if (!sousCategorie) continue;

        const nom = sousCategorie.nom;

        let points: number;
        if (cachePoints.has(nom)) {
          points = cachePoints.get(nom)!;
        } else {
          points = await this.sousCategorieService.getPointsByName(nom);
          cachePoints.set(nom, points);
        }

        if (points === 10) facile++;
        else if (points === 20) moyen++;
        else if (points === 30) difficile++;
      }

      resultats.push({
        mois: `${moisFrancais[moisRef]} ${anneeRef}`,
        ticketFacile: facile,
        ticketMoyen: moyen,
        ticketDifficile: difficile,
        total: facile + moyen + difficile,
      });
    }

    return resultats;
  }

  //8. repartition par mois des tickets pour voir le temps de realisation(FACILE)
  async calculerTempsMoyenParSemaineParComplexitePourAgent(
    idAgent: number,
    mois?: number,
    annee?: number,
  ): Promise<{
    faciles: { semaine: number; tempsMoyenHeures: number }[];
    moyens: { semaine: number; tempsMoyenHeures: number }[];
    difficiles: { semaine: number; tempsMoyenHeures: number }[];
  }> {
    const aujourdHui = new Date();
    const moisCible = mois ?? aujourdHui.getMonth() + 1;
    const anneeCible = annee ?? aujourdHui.getFullYear();
  
    const estMoisCourant =
      moisCible === aujourdHui.getMonth() + 1 &&
      anneeCible === aujourdHui.getFullYear();
  
    const dateDebut = new Date(anneeCible, moisCible - 1, 1);
    const dateFin = estMoisCourant
      ? new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), aujourdHui.getDate() - 1, 23, 59, 59)
      : new Date(anneeCible, moisCible, 0, 23, 59, 59);
  
    const tickets = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.technicien', 'technicien')
      .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie')
      .where('ticket.state = 3')
      .andWhere('ticket.technician = :idAgent', { idAgent })
      .andWhere('ticket.date_create BETWEEN :debut AND :fin', {
        debut: dateDebut,
        fin: dateFin,
      })
      .getMany();
  
    const categories = {
      faciles: new Map<number, { totalHeures: number; nombre: number }>(),
      moyens: new Map<number, { totalHeures: number; nombre: number }>(),
      difficiles: new Map<number, { totalHeures: number; nombre: number }>(),
    };
  
    for (const ticket of tickets) {
      const points = await this.sousCategorieService.getPointsByName(ticket.sousCategorie.nom);
      const debut = new Date(ticket.dateCreation);
      const fin = new Date(ticket.dateResolution);
      const dureeHeures = (fin.getTime() - debut.getTime()) / (1000 * 60 * 60);
      const semaine = this.getNumeroSemaine(fin);
  
      let mapCible: Map<number, { totalHeures: number; nombre: number }> | undefined;
  
      if (points === 10) mapCible = categories.faciles;
      else if (points === 20) mapCible = categories.moyens;
      else if (points === 30) mapCible = categories.difficiles;
  
      if (mapCible) {
        const current = mapCible.get(semaine) ?? { totalHeures: 0, nombre: 0 };
        current.totalHeures += dureeHeures;
        current.nombre += 1;
        mapCible.set(semaine, current);
      }
    }
  
    const formatter = (map: Map<number, { totalHeures: number; nombre: number }>) =>
      Array.from(map.entries())
        .sort(([a], [b]) => a - b)
        .map(([semaine, { totalHeures, nombre }]) => ({
          semaine,
          tempsMoyenHeures: parseFloat((totalHeures / nombre).toFixed(2)),
        }));
  
    return {
      faciles: formatter(categories.faciles),
      moyens: formatter(categories.moyens),
      difficiles: formatter(categories.difficiles),
    };
  }
  

  private getNumeroSemaine(date: Date): number {
    const debutMois = new Date(date.getFullYear(), date.getMonth(), 1);
    const jourDebutMois = debutMois.getDay() || 5; 
  
    const jourDuMois = date.getDate();
    const positionDansMois = jourDuMois + (jourDebutMois - 1); 
    const numeroSemaineMois = Math.ceil(positionDansMois / 7);
  
    return numeroSemaineMois;
  }
  
  
  private convertirEnHeuresMinutes(heures: number): string {
    const h = Math.floor(heures);
    const m = Math.round((heures - h) * 60);
    return `${h}h${m.toString().padStart(2, '0')}`;
  }
  
  //11.les tickets realisés par nom 

  async getTicketsRealisesParId(idAgent: number, mois?: number, annee?: number) {
    const now = new Date();
    const targetMois = mois ?? now.getMonth() + 1;
    const targetAnnee = annee ?? now.getFullYear();
  
    const debut = new Date(targetAnnee, targetMois - 1, 1);
    const fin = (mois && annee)
      ? new Date(targetAnnee, targetMois, 1)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate()); // jusqu'à aujourd’hui
  
    const ticketsAgent = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.technicien', 'agent')
      .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie')
      .where('ticket.statut = :state', { state: 3 })
      .andWhere('ticket.dateCreation BETWEEN :debut AND :fin', { debut, fin })
      .andWhere('agent.idAgent = :idAgent', { idAgent }) // <-- Changement ici
      .select([
        'ticket.idTicket AS idTicket',
        'ticket.dateCreation AS dateCreation',
        'ticket.dateResolution AS dateResolution',
        'sousCategorie.nom AS sousCategorieNom',
      ])
      .getRawMany();
  
    const sousCategories = [...new Set(ticketsAgent.map(t => t.sousCategorieNom))];
    const moyennesParSousCategorie: Record<string, number> = {};
  
    for (const sousCategorieNom of sousCategories) {
      const ticketsSousCat = await this.ticketRepository.find({
        where: {
          statut: 3,
          dateCreation: Between(debut, fin),
          sousCategorie: {
            nom: sousCategorieNom,
          },
        },
        relations: ['sousCategorie'],
        select: ['dateCreation', 'dateResolution'],
      });
  
      const tempsTotaux = ticketsSousCat
        .map(t => new Date(t.dateResolution).getTime() - new Date(t.dateCreation).getTime())
        .filter(duree => !isNaN(duree));
  
      const moyenne =
        tempsTotaux.length > 0
          ? tempsTotaux.reduce((a, b) => a + b, 0) / tempsTotaux.length
          : 0;
  
      moyennesParSousCategorie[sousCategorieNom] = moyenne;
    }
  
    return Promise.all(
      ticketsAgent.map(async (ticket) => {
        const dureeAgent = new Date(ticket.dateResolution).getTime() - new Date(ticket.dateCreation).getTime();
        const points = await this.sousCategorieService.getPointsByName(ticket.sousCategorieNom);
        const type = points === 10 ? 'facile' : points === 20 ? 'moyen' : 'difficile';
  
        return {
          id: ticket.idTicket,
          type,
          tempsMoyenDeResolution: this.msToHeureMinute(moyennesParSousCategorie[ticket.sousCategorieNom] ?? 0),
          tempsDeResolutionAgent: this.msToHeureMinute(dureeAgent),
        };
      }),
    );
  }
  
  //12.Taux de resolution d'un agent FACILE
  async getStatistiquesTicketsParComplexite(idAgent: number, mois?: number, annee?: number) {
    const now = new Date();
    const targetMois = mois ?? now.getMonth() + 1;
    const targetAnnee = annee ?? now.getFullYear();
  
    const debut = new Date(targetAnnee, targetMois - 1, 1);
    const fin =
      mois && annee
        ? new Date(targetAnnee, targetMois, 1)
        : new Date(now.getFullYear(), now.getMonth(), now.getDate()); // jusqu’à hier
  
    // Récupération de tous les tickets de l'agent pour la période
    const tickets = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoin('ticket.technicien', 'agent')
      .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie')
      .where('agent.id = :idAgent', { idAgent })
      .andWhere('ticket.dateCreation BETWEEN :debut AND :fin', { debut, fin })
      .getMany();
  
    // Attribution des points pour chaque ticket
    const ticketsAvecPoints = await Promise.all(
      tickets.map(async (ticket) => {
        const points = await this.sousCategorieService.getPointsByName(ticket.sousCategorie.nom);
        return {
          ...ticket,
          points,
        };
      })
    );
  
    // Fonction utilitaire pour calculer les stats par complexité
    const calculerStats = (ticketsFiltres: typeof ticketsAvecPoints) => {
      const totalRepartis = ticketsFiltres.length;
      const resolus = ticketsFiltres.filter(t => t.statut === 3).length;
      const pourcentage = totalRepartis > 0 ? parseFloat(((resolus / totalRepartis) * 100).toFixed(2)) : 0;
      return [{ totalRepartis, resolus, pourcentage }];
    };
  
    const faciles = ticketsAvecPoints.filter(t => t.points === 10);
    const moyens = ticketsAvecPoints.filter(t => t.points === 20);
    const difficiles = ticketsAvecPoints.filter(t => t.points === 30);
  
    return {
      faciles: calculerStats(faciles),
      moyens: calculerStats(moyens),
      difficiles: calculerStats(difficiles),
    };
  }
  
  //15.Periode de forte activité point
  async obtenirPointsTicketsEnCoursDes10MoisPrecedents(mois?: number, annee?: number): Promise<
  {
    mois: string;
    ticketFacile: number;
    ticketMoyen: number;
    ticketDifficile: number;
    total: number;
  }[]
  >{
    const resultats: {
      mois: string;
      ticketFacile: number;
      ticketMoyen: number;
      ticketDifficile: number;
      total: number;
    }[] = [];

    const today = new Date();
    const currentMonth = mois ?? today.getMonth() + 1;
    const currentYear = annee ?? today.getFullYear();

    const moisFrancais = [
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];

    const cachePoints = new Map<string, number>();

    for (let i = 9; i >= 0; i--) {
      const dateRef = new Date(currentYear, currentMonth - 1 - i, 1);
      const moisRef = dateRef.getMonth(); // 0-11
      const anneeRef = dateRef.getFullYear();

      const debut = new Date(anneeRef, moisRef, 1);
      const fin = new Date(anneeRef, moisRef + 1, 0, 23, 59, 59, 999);

      const tickets = await this.ticketRepository
        .createQueryBuilder('ticket')
        .where('ticket.state = :state', { state: 2 }) // En cours
        .andWhere('ticket.date_create BETWEEN :start AND :end', { start: debut, end: fin })
        .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie')
        .getMany();

      let pointsFacile = 0, pointsMoyen = 0, pointsDifficile = 0;

      for (const ticket of tickets) {
        const sousCategorie = ticket.sousCategorie;
        if (!sousCategorie) continue;

        const nom = sousCategorie.nom;

        let points: number;
        if (cachePoints.has(nom)) {
          points = cachePoints.get(nom)!;
        } else {
          points = await this.sousCategorieService.getPointsByName(nom);
          cachePoints.set(nom, points);
        }

        if (points === 10) pointsFacile += 10;
        else if (points === 20) pointsMoyen += 20;
        else if (points === 30) pointsDifficile += 30;
      }

      resultats.push({
        mois: `${moisFrancais[moisRef]} ${anneeRef}`,
        ticketFacile: pointsFacile,
        ticketMoyen: pointsMoyen,
        ticketDifficile: pointsDifficile,
        total: pointsFacile + pointsMoyen + pointsDifficile,
      });
    }

    return resultats;
  }

  //16.Temps de resolution de tous les agents
  async getTempsMoyenResolutionParComplexiteEtAgent(mois?: number, annee?: number) {
    const aujourdHui = new Date();
    const moisCible = mois ?? aujourdHui.getMonth() + 1;
    const anneeCible = annee ?? aujourdHui.getFullYear();
  
    const dateDebut = new Date(anneeCible, moisCible - 1, 1);
    const dateFin = (mois && annee)
      ? new Date(anneeCible, moisCible, 1)
      : new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), aujourdHui.getDate());
  
    const tousLesAgents = await this.agentService.getAllAgents();
  
    const tempsParAgent: Record<number, {
      nomComplet: string;
      facile: number[];
      moyen: number[];
      difficile: number[];
    }> = {};
  
    for (const agent of tousLesAgents) {
      const idAgent = Number(agent.idAgent);
      tempsParAgent[idAgent] = {
        nomComplet: `${agent.nom} ${agent.prenom}`,
        facile: [],
        moyen: [],
        difficile: [],
      };
    }
  
    const tickets = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie')
      .leftJoinAndSelect('ticket.technicien', 'technicien')
      .where('ticket.statut = :resolu', { resolu: 3 })
      .andWhere('ticket.dateCreation BETWEEN :debut AND :fin', {
        debut: dateDebut,
        fin: dateFin,
      })
      .getMany();
  
    const pointsParCategorie = new Map<string, number>();
  
    for (const ticket of tickets) {
      if (!ticket.technicien || !ticket.technicien.idAgent || !ticket.dateResolution || !ticket.sousCategorie) {
        continue;
      }
  
      const idAgent = ticket.technicien.idAgent;
      const dureeResolution = new Date(ticket.dateResolution).getTime() - new Date(ticket.dateCreation).getTime();
      if (dureeResolution <= 0) continue;
  
      const nomCategorie = ticket.sousCategorie.nom;
      let points: number;
      if (pointsParCategorie.has(nomCategorie)) {
        points = pointsParCategorie.get(nomCategorie)!;
      } else {
        points = await this.sousCategorieService.getPointsByName(nomCategorie);
        pointsParCategorie.set(nomCategorie, points);
      }
  
      const dureeHeures = dureeResolution / (1000 * 60 * 60); // convertit en heures décimales
  
      if (points === 10) tempsParAgent[idAgent].facile.push(dureeHeures);
      else if (points === 20) tempsParAgent[idAgent].moyen.push(dureeHeures);
      else if (points === 30) tempsParAgent[idAgent].difficile.push(dureeHeures);
    }
  
    const calculerMoyenne = (tableau: number[]) =>
      tableau.length ? +(tableau.reduce((a, b) => a + b, 0) / tableau.length).toFixed(2) : 0;
  
    const agents: string[] = [];
    const ticketFacile: number[] = [];
    const ticketMoyen: number[] = [];
    const ticketDifficile: number[] = [];
  
    for (const id of Object.keys(tempsParAgent)) {
      const data = tempsParAgent[+id];
      agents.push(data.nomComplet);
      ticketFacile.push(calculerMoyenne(data.facile));
      ticketMoyen.push(calculerMoyenne(data.moyen));
      ticketDifficile.push(calculerMoyenne(data.difficile));
    }
  
    return {
      agents,
      ticketFacile,
      ticketMoyen,
      ticketDifficile,
    };
  }
      
  //17. Classement
  async getClassementAgents(mois?: number, annee?: number) {
    const today = new Date();
    const targetMois = mois ?? today.getMonth() + 1;
    const targetAnnee = annee ?? today.getFullYear();
  
    const getDateRange = (m: number, a: number) => {
      const start = new Date(a, m - 1, 1);
      const isCurrent = m === today.getMonth() + 1 && a === today.getFullYear();
      const end = isCurrent
        ? new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 23, 59, 59)
        : new Date(a, m, 0, 23, 59, 59);
      return { start, end };
    };
  
    const getTicketsByDate = async (startDate: Date, endDate: Date) => {
      return this.ticketRepository.find({
        relations: ['technicien', 'sousCategorie'],
        where: {
          statut: 3,
          dateCreation: Between(startDate, endDate),
        },
      });
    };
  
    const complexityScores: Record<
      'facile' | 'moyen' | 'difficile',
      { id: number; nom: string; prenom: string; score: number }
    > = {
      facile: { id: -1, nom: '', prenom: '', score: -1 },
      moyen: { id: -1, nom: '', prenom: '', score: -1 },
      difficile: { id: -1, nom: '', prenom: '', score: -1 },
    };
  
    const lastMonthWithTickets: Record<'facile' | 'moyen' | 'difficile', boolean> = {
      facile: false,
      moyen: false,
      difficile: false,
    };
  
    let meilleurGlobal = { id: -1, nom: '', prenom: '', score: -1 };
  
    // Fonction utilitaire : chercher tickets d'une complexité sur le dernier mois disponible
    const chercherDernierMoisDisponible = async (complexite: 'facile' | 'moyen' | 'difficile') => {
      let mois = targetMois;
      let annee = targetAnnee;
  
      while (annee >= 2000) {
        const { start, end } = getDateRange(mois, annee);
        const tickets = await getTicketsByDate(start, end);
  
        const filtres = await Promise.all(
          tickets.map(async t => {
            const pts = await this.sousCategorieService.getPointsByName(t.sousCategorie?.nom);
            const type = pts === 10 ? 'facile' : pts === 20 ? 'moyen' : 'difficile';
            return type === complexite ? t : null;
          })
        );
  
        const filteredTickets = filtres.filter(Boolean) as any[];
        if (filteredTickets.length > 0) {
          return { tickets: filteredTickets, mois, annee };
        }
  
        mois--;
        if (mois === 0) {
          mois = 12;
          annee--;
        }
      }
  
      return { tickets: [], mois: -1, annee: -1 };
    };
  
    const calculerClassement = async (moisCalc: number, anneeCalc: number) => {
      const { start, end } = getDateRange(moisCalc, anneeCalc);
      const tickets = await getTicketsByDate(start, end);
  
      const grouped: Record<
        number,
        { agent: any; ticketsParComplexite: { facile: any[]; moyen: any[]; difficile: any[] } }
      > = {};
  
      for (const ticket of tickets) {
        const agent = ticket.technicien;
        const sousCategorie = ticket.sousCategorie;
        if (!agent || !ticket.dateCreation || !ticket.dateResolution || !sousCategorie) continue;
  
        const points = await this.sousCategorieService.getPointsByName(sousCategorie.nom);
        const complexite = points === 10 ? 'facile' : points === 20 ? 'moyen' : 'difficile';
  
        if (!grouped[agent.idAgent]) {
          grouped[agent.idAgent] = {
            agent,
            ticketsParComplexite: { facile: [], moyen: [], difficile: [] },
          };
        }
  
        grouped[agent.idAgent].ticketsParComplexite[complexite].push(ticket);
      }
  
      for (const [id, data] of Object.entries(grouped)) {
        const { agent, ticketsParComplexite } = data;
        let scoreGlobal = 0;
  
        for (const type of ['facile', 'moyen', 'difficile'] as const) {
          const tickets = ticketsParComplexite[type];
          if (tickets.length === 0) continue;
  
          const totalAssignes = tickets.length;
          const totalResolus = tickets.length;
  
          const resolusRapides = tickets.filter(t => {
            const d1 = new Date(t.dateCreation).getTime();
            const d2 = new Date(t.dateResolution).getTime();
            return (d2 - d1) / (1000 * 3600 * 24) <= 1;
          }).length;
  
          const tauxRealisation = totalAssignes > 0 ? totalResolus / totalAssignes : 0;
          const tauxResolutionRapide = totalResolus > 0 ? resolusRapides / totalResolus : 0;
          const volumeTraite = totalResolus;
  
          const score =
            tauxRealisation * 0.5 +
            tauxResolutionRapide * 0.3 +
            (volumeTraite / 100) * 0.2;
  
          scoreGlobal += score;
  
          if (score > complexityScores[type].score) {
            complexityScores[type] = {
              id: agent.idAgent,
              nom: agent.nom,
              prenom: agent.prenom,
              score: parseFloat(score.toFixed(2)),
            };
            lastMonthWithTickets[type] = true;
          }
        }
  
        if (scoreGlobal > meilleurGlobal.score) {
          meilleurGlobal = {
            id: agent.idAgent,
            nom: agent.nom,
            prenom: agent.prenom,
            score: parseFloat(scoreGlobal.toFixed(2)),
          };
        }
      }
    };
   await calculerClassement(targetMois, targetAnnee);
    for (const type of ['facile', 'moyen', 'difficile'] as const) {
      if (!lastMonthWithTickets[type]) {
        const result = await chercherDernierMoisDisponible(type);
        if (result.tickets.length > 0) {
          const grouped = result.tickets.reduce((acc, t) => {
            const agent = t.technicien;
            if (!acc[agent.idAgent]) {
              acc[agent.idAgent] = {
                agent,
                ticketsParComplexite: { facile: [], moyen: [], difficile: [] },
              };
            }
            acc[agent.idAgent].ticketsParComplexite[type].push(t);
            return acc;
          }, {} as any);
  
          for (const [_, data] of Object.entries(grouped) as [string, { agent: any; ticketsParComplexite: { [key: string]: any[] } }][]) {
            const { agent, ticketsParComplexite } = data;
            const tickets = ticketsParComplexite[type];
            if (tickets.length === 0) continue;
  
            const totalAssignes = tickets.length;
            const totalResolus = tickets.length;
            const resolusRapides = tickets.filter(t => {
              const d1 = new Date(t.dateCreation).getTime();
              const d2 = new Date(t.dateResolution).getTime();
              return (d2 - d1) / (1000 * 3600 * 24) <= 1;
            }).length;
  
            const tauxRealisation = totalAssignes > 0 ? totalResolus / totalAssignes : 0;
            const tauxResolutionRapide = totalResolus > 0 ? resolusRapides / totalResolus : 0;
            const volumeTraite = totalResolus;
  
            const score =
              tauxRealisation * 0.5 +
              tauxResolutionRapide * 0.3 +
              (volumeTraite / 100) * 0.2;
  
            if (score > complexityScores[type].score) {
              complexityScores[type] = {
                id: agent.idAgent,
                nom: agent.nom,
                prenom: agent.prenom,
                score: parseFloat(score.toFixed(2)),
              };
            }
          }
        }
      }
    }
  
    return {
      facile: complexityScores.facile,
      moyen: complexityScores.moyen,
      difficile: complexityScores.difficile,
      global: meilleurGlobal,
    };
  }
  
  //18.Recherche
  async rechercherParIdentifiantOuNom(terme: string | number) {
    let idAgent: number;
  
    if (!isNaN(Number(terme))) {
      idAgent = Number(terme);
    } else {
      const info = await this.agentService.getInfoAgentParNomOuPrenom(terme.toString());
      if (!info) {
        throw new NotFoundException(`Aucun agent trouvé pour : ${terme}`);
      }
      idAgent = info.idAgent;
    }
  
    const [tickets, tempsParSemaine, statsComplexite, infoAgent] = await Promise.all([
      this.getTicketsRealisesParId(idAgent),
      this.calculerTempsMoyenParSemaineParComplexitePourAgent(idAgent),
      this.getStatistiquesTicketsParComplexite(idAgent),
      this.agentService.getInfoAgentParId(idAgent),
    ]);
  
    return {
      idAgent,
      infoAgent,
      ticketsRealises: tickets,
      tempsMoyenParSemaine: tempsParSemaine,
      statsParComplexite: statsComplexite,
    };
  }
  
  
    

}
