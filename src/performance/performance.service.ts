import { Injectable } from '@nestjs/common';
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
      agentName: string;
      nombre: string;
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
        agentName: `${agent.nom} ${agent.prenom}`,
        nombre: `${count}/${totalTickets}`,
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
  async calculerTempsMoyenResolutionFacileParAgent(
    mois?: number,
    annee?: number,
  ): Promise<
    {
      agentId: number;
      nomAgent: string;
      nombreTickets: number;
      tempsMoyenHeures: number;
    }[]
  > {
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
      .leftJoinAndSelect('ticket.technicien', 'technicien')
      .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie')
      .where('ticket.state = :etatResolu', { etatResolu: 3 })
      .andWhere('ticket.date_res BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getMany();
  
    const resultats = new Map<number, {
      agentId: number;
      nomAgent: string;
      totalTemps: number;
      nombreTickets: number;
    }>();
  
    for (const ticket of tickets) {
      const agent = ticket.technicien;
      const sousCategorie = ticket.sousCategorie;
  
      if (!agent || !sousCategorie) continue;
  
      const points = await this.sousCategorieService.getPointsByName(sousCategorie.nom);
      if (points !== 10) continue; 
  
      const dateDebut = new Date(ticket.dateCreation);
      const dateFin = new Date(ticket.dateResolution);
      const tempsResolutionHeures = (dateFin.getTime() - dateDebut.getTime()) / (1000 * 60 * 60);
  
      if (!resultats.has(agent.idAgent)) {
        resultats.set(agent.idAgent, {
          agentId: agent.idAgent,
          nomAgent: agent.prenom,
          totalTemps: 0,
          nombreTickets: 0,
        });
      }
  
      const donnees = resultats.get(agent.idAgent)!;
      donnees.totalTemps += tempsResolutionHeures;
      donnees.nombreTickets += 1;
    }
  
    return Array.from(resultats.values()).map(res => ({
      agentId: res.agentId,
      nomAgent: res.nomAgent,
      nombreTickets: res.nombreTickets,
      tempsMoyenHeures: res.nombreTickets > 0 ? parseFloat((res.totalTemps / res.nombreTickets).toFixed(2)) : 0,
    }));
  }
  
  //5. Temps moyen de resolution des tickets MOYENS
  async calculerTempsMoyenResolutionMoyenParAgent(
    mois?: number,
    annee?: number,
  ): Promise<
    {
      agentId: number;
      nomAgent: string;
      nombreTickets: number;
      tempsMoyenHeures: number;
    }[]
  > {
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
      .leftJoinAndSelect('ticket.technicien', 'technicien')
      .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie')
      .where('ticket.state = :etatResolu', { etatResolu: 3 })
      .andWhere('ticket.date_res BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getMany();
  
    const resultats = new Map<number, {
      agentId: number;
      nomAgent: string;
      totalTemps: number;
      nombreTickets: number;
    }>();
  
    for (const ticket of tickets) {
      const agent = ticket.technicien;
      const sousCategorie = ticket.sousCategorie;
  
      if (!agent || !sousCategorie) continue;
  
      const points = await this.sousCategorieService.getPointsByName(sousCategorie.nom);
      if (points !== 20) continue; 
  
      const dateDebut = new Date(ticket.dateCreation);
      const dateFin = new Date(ticket.dateResolution);
      const tempsResolutionHeures = (dateFin.getTime() - dateDebut.getTime()) / (1000 * 60 * 60);
  
      if (!resultats.has(agent.idAgent)) {
        resultats.set(agent.idAgent, {
          agentId: agent.idAgent,
          nomAgent: agent.prenom,
          totalTemps: 0,
          nombreTickets: 0,
        });
      }
  
      const donnees = resultats.get(agent.idAgent)!;
      donnees.totalTemps += tempsResolutionHeures;
      donnees.nombreTickets += 1;
    }
  
    return Array.from(resultats.values()).map(res => ({
      agentId: res.agentId,
      nomAgent: res.nomAgent,
      nombreTickets: res.nombreTickets,
      tempsMoyenHeures: res.nombreTickets > 0 ? parseFloat((res.totalTemps / res.nombreTickets).toFixed(2)) : 0,
    }));
  }
  
  //6. Temps moyen de resolution des tickets MOYENS
  async calculerTempsMoyenResolutionDifficileParAgent(
    mois?: number,
    annee?: number,
  ): Promise<
    {
      agentId: number;
      nomAgent: string;
      nombreTickets: number;
      tempsMoyenHeures: number;
    }[]
  > {
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
      .leftJoinAndSelect('ticket.technicien', 'technicien')
      .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie')
      .where('ticket.state = :etatResolu', { etatResolu: 3 })
      .andWhere('ticket.date_res BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getMany();
  
    const resultats = new Map<number, {
      agentId: number;
      nomAgent: string;
      totalTemps: number;
      nombreTickets: number;
    }>();
  
    for (const ticket of tickets) {
      const agent = ticket.technicien;
      const sousCategorie = ticket.sousCategorie;
  
      if (!agent || !sousCategorie) continue;
  
      const points = await this.sousCategorieService.getPointsByName(sousCategorie.nom);
      if (points !== 30) continue; 
  
      const dateDebut = new Date(ticket.dateCreation);
      const dateFin = new Date(ticket.dateResolution);
      const tempsResolutionHeures = (dateFin.getTime() - dateDebut.getTime()) / (1000 * 60 * 60);
  
      if (!resultats.has(agent.idAgent)) {
        resultats.set(agent.idAgent, {
          agentId: agent.idAgent,
          nomAgent: agent.prenom,
          totalTemps: 0,
          nombreTickets: 0,
        });
      }
  
      const donnees = resultats.get(agent.idAgent)!;
      donnees.totalTemps += tempsResolutionHeures;
      donnees.nombreTickets += 1;
    }
  
    return Array.from(resultats.values()).map(res => ({
      agentId: res.agentId,
      nomAgent: res.nomAgent,
      nombreTickets: res.nombreTickets,
      tempsMoyenHeures: res.nombreTickets > 0 ? parseFloat((res.totalTemps / res.nombreTickets).toFixed(2)) : 0,
    }));
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
  async calculerTempsMoyenParSemainePourAgentTicketFacile(
    nomComplet: string,
    mois?: number,
    annee?: number,
  ): Promise<{ semaineDebut: string; tempsMoyenHeures: number }[]> {
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
  
    const [nom, prenom] = nomComplet.trim().split(' ');
    const agent = await this.agentService.getAgentByPrenomEtNom(prenom, nom);
      
    const ticketsTrouves = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.technicien', 'technicien')
      .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie')
      .where('ticket.state = 3')
      .andWhere('ticket.technician = :idAgent', { idAgent: agent!.idAgent })
      .andWhere('ticket.date_create BETWEEN :debut AND :fin', {
        debut: dateDebut,
        fin: dateFin,
      })
      .getMany();
  
    const ticketsFaciles: Ticket[] = [];
    for (const ticket of ticketsTrouves) {
      const points = await this.sousCategorieService.getPointsByName(ticket.sousCategorie.nom);
      if (points === 10) {
        ticketsFaciles.push(ticket);
      }
    }
  
    const resultatsParSemaine = new Map<string, { totalHeures: number; nombre: number }>();
  
    for (const ticket of ticketsFaciles) {
      const debut = new Date(ticket.dateCreation);
      const fin = new Date(ticket.dateResolution);
      const dureeHeures = (fin.getTime() - debut.getTime()) / (1000 * 60 * 60);
  
      const jour = fin.getDay();
      const decalage = jour === 0 ? -6 : 1 - jour;
      const debutSemaine = new Date(fin);
      debutSemaine.setDate(fin.getDate() + decalage);
      debutSemaine.setHours(0, 0, 0, 0);
  
      const cleSemaine = debutSemaine.toISOString().slice(0, 10);
      const existant = resultatsParSemaine.get(cleSemaine) || {
        totalHeures: 0,
        nombre: 0,
      };
      existant.totalHeures += dureeHeures;
      existant.nombre += 1;
      resultatsParSemaine.set(cleSemaine, existant);
    }
  
    return Array.from(resultatsParSemaine.entries())
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([semaineDebut, { totalHeures, nombre }]) => ({
        semaineDebut,
        tempsMoyenHeures: parseFloat((totalHeures / nombre).toFixed(2)),
      }));
  }
  //9. repartition par mois des tickets pour voir le temps de realisation(MOYEN)
  async calculerTempsMoyenParSemainePourAgentTicketMoyen(
    nomComplet: string,
    mois?: number,
    annee?: number,
  ): Promise<{ semaineDebut: string; tempsMoyenHeures: number }[]> {
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
  
    const [nom, prenom] = nomComplet.trim().split(' ');
    const agent = await this.agentService.getAgentByPrenomEtNom(prenom, nom);
      
    const ticketsTrouves = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.technicien', 'technicien')
      .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie')
      .where('ticket.state = 3')
      .andWhere('ticket.technician = :idAgent', { idAgent: agent!.idAgent })
      .andWhere('ticket.date_create BETWEEN :debut AND :fin', {
        debut: dateDebut,
        fin: dateFin,
      })
      .getMany();
  
    const ticketsFaciles: Ticket[] = [];
    for (const ticket of ticketsTrouves) {
      const points = await this.sousCategorieService.getPointsByName(ticket.sousCategorie.nom);
      if (points === 20) {
        ticketsFaciles.push(ticket);
      }
    }
  
    const resultatsParSemaine = new Map<string, { totalHeures: number; nombre: number }>();
  
    for (const ticket of ticketsFaciles) {
      const debut = new Date(ticket.dateCreation);
      const fin = new Date(ticket.dateResolution);
      const dureeHeures = (fin.getTime() - debut.getTime()) / (1000 * 60 * 60);
  
      const jour = fin.getDay();
      const decalage = jour === 0 ? -6 : 1 - jour;
      const debutSemaine = new Date(fin);
      debutSemaine.setDate(fin.getDate() + decalage);
      debutSemaine.setHours(0, 0, 0, 0);
  
      const cleSemaine = debutSemaine.toISOString().slice(0, 10);
      const existant = resultatsParSemaine.get(cleSemaine) || {
        totalHeures: 0,
        nombre: 0,
      };
      existant.totalHeures += dureeHeures;
      existant.nombre += 1;
      resultatsParSemaine.set(cleSemaine, existant);
    }
  
    return Array.from(resultatsParSemaine.entries())
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([semaineDebut, { totalHeures, nombre }]) => ({
        semaineDebut,
        tempsMoyenHeures: parseFloat((totalHeures / nombre).toFixed(2)),
      }));
  }
  //10. repartition par mois des tickets pour voir le temps de realisation(DIFFICILE)
  async calculerTempsMoyenParSemainePourAgentTicketDifficile(
    nomComplet: string,
    mois?: number,
    annee?: number,
  ): Promise<{ semaineDebut: string; tempsMoyenHeures: number }[]> {
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
  
    const [nom, prenom] = nomComplet.trim().split(' ');
    const agent = await this.agentService.getAgentByPrenomEtNom(prenom, nom);
      
    const ticketsTrouves = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.technicien', 'technicien')
      .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie')
      .where('ticket.state = 3')
      .andWhere('ticket.technician = :idAgent', { idAgent: agent!.idAgent })
      .andWhere('ticket.date_create BETWEEN :debut AND :fin', {
        debut: dateDebut,
        fin: dateFin,
      })
      .getMany();
  
    const ticketsFaciles: Ticket[] = [];
    for (const ticket of ticketsTrouves) {
      const points = await this.sousCategorieService.getPointsByName(ticket.sousCategorie.nom);
      if (points === 30) {
        ticketsFaciles.push(ticket);
      }
    }
  
    const resultatsParSemaine = new Map<string, { totalHeures: number; nombre: number }>();
  
    for (const ticket of ticketsFaciles) {
      const debut = new Date(ticket.dateCreation);
      const fin = new Date(ticket.dateResolution);
      const dureeHeures = (fin.getTime() - debut.getTime()) / (1000 * 60 * 60);
  
      const jour = fin.getDay();
      const decalage = jour === 0 ? -6 : 1 - jour;
      const debutSemaine = new Date(fin);
      debutSemaine.setDate(fin.getDate() + decalage);
      debutSemaine.setHours(0, 0, 0, 0);
  
      const cleSemaine = debutSemaine.toISOString().slice(0, 10);
      const existant = resultatsParSemaine.get(cleSemaine) || {
        totalHeures: 0,
        nombre: 0,
      };
      existant.totalHeures += dureeHeures;
      existant.nombre += 1;
      resultatsParSemaine.set(cleSemaine, existant);
    }
  
    return Array.from(resultatsParSemaine.entries())
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([semaineDebut, { totalHeures, nombre }]) => ({
        semaineDebut,
        tempsMoyenHeures: parseFloat((totalHeures / nombre).toFixed(2)),
      }));
  }
  
  //11.les tickets realisés par nom 

  async getTicketsRealisesParNom(nomComplet: string, mois?: number, annee?: number) {
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
      .andWhere("CONCAT(agent.nom, ' ', agent.prenom) = :nomComplet", { nomComplet })
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
  async getStatistiquesTicketsFacilesParAgent(nomComplet: string, mois?: number, annee?: number) {
    const now = new Date();
    const targetMois = mois ?? now.getMonth() + 1;
    const targetAnnee = annee ?? now.getFullYear();
  
    const debut = new Date(targetAnnee, targetMois - 1, 1);
    const fin =
      mois && annee
        ? new Date(targetAnnee, targetMois, 1)
        : new Date(now.getFullYear(), now.getMonth(), now.getDate()); // jusqu’à hier
  
    const tickets = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoin('ticket.technicien', 'agent')
      .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie')
      .where("CONCAT(agent.nom, ' ', agent.prenom) = :nomComplet", { nomComplet })
      .andWhere('ticket.dateCreation BETWEEN :debut AND :fin', { debut, fin })
      .getMany();
  
    const ticketsFaciles = await Promise.all(
      tickets.map(async (ticket) => {
        const points = await this.sousCategorieService.getPointsByName(ticket.sousCategorie.nom);
        return {
          ...ticket,
          estFacile: points === 10,
        };
      })
    );
  
    const ticketsFacilesRecus = ticketsFaciles.filter(t => t.estFacile).length;
    const ticketsFacilesResolus = ticketsFaciles.filter(t => t.estFacile && t.statut === 3).length;
  
    const tauxRealisation =
      ticketsFacilesRecus > 0
        ? Math.round((ticketsFacilesResolus / ticketsFacilesRecus) * 100)
        : 0;
  
    return {
      agent: nomComplet,
      ticketsFacilesRecus,
      ticketsFacilesResolus,
      tauxRealisation: `${tauxRealisation}%`,
    };
  }

  //13.Taux de resolution d'un agent MOYEN
  async getStatistiquesTicketsMoyensParAgent(nomComplet: string, mois?: number, annee?: number) {
    const now = new Date();
    const targetMois = mois ?? now.getMonth() + 1;
    const targetAnnee = annee ?? now.getFullYear();
  
    const debut = new Date(targetAnnee, targetMois - 1, 1);
    const fin =
      mois && annee
        ? new Date(targetAnnee, targetMois, 1)
        : new Date(now.getFullYear(), now.getMonth(), now.getDate()); // jusqu’à hier
  
    const tickets = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoin('ticket.technicien', 'agent')
      .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie')
      .where("CONCAT(agent.nom, ' ', agent.prenom) = :nomComplet", { nomComplet })
      .andWhere('ticket.dateCreation BETWEEN :debut AND :fin', { debut, fin })
      .getMany();
  
    const ticketsMoyens = await Promise.all(
      tickets.map(async (ticket) => {
        const points = await this.sousCategorieService.getPointsByName(ticket.sousCategorie.nom);
        return {
          ...ticket,
          estMoyen: points === 20,
        };
      })
    );
  
    const ticketsMoyensRecus = ticketsMoyens.filter(t => t.estMoyen).length;
    const ticketsMoyensResolus = ticketsMoyens.filter(t => t.estMoyen && t.statut === 3).length;
  
    const tauxRealisation =
      ticketsMoyensRecus > 0
        ? Math.round((ticketsMoyensResolus / ticketsMoyensRecus) * 100)
        : 0;
  
    return {
      agent: nomComplet,
      ticketsMoyensRecus,
      ticketsMoyensResolus,
      tauxRealisation: `${tauxRealisation}%`,
    };
  }

  //14.Taux de resolution d'un agent DIFFICILE
  async getStatistiquesTicketsDifficilesParAgent(nomComplet: string, mois?: number, annee?: number) {
    const now = new Date();
    const targetMois = mois ?? now.getMonth() + 1;
    const targetAnnee = annee ?? now.getFullYear();
  
    const debut = new Date(targetAnnee, targetMois - 1, 1);
    const fin =
      mois && annee
        ? new Date(targetAnnee, targetMois, 1)
        : new Date(now.getFullYear(), now.getMonth(), now.getDate()); // jusqu’à hier
  
    const tickets = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoin('ticket.technicien', 'agent')
      .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie')
      .where("CONCAT(agent.nom, ' ', agent.prenom) = :nomComplet", { nomComplet })
      .andWhere('ticket.dateCreation BETWEEN :debut AND :fin', { debut, fin })
      .getMany();
  
    const ticketsDifficiles = await Promise.all(
      tickets.map(async (ticket) => {
        const points = await this.sousCategorieService.getPointsByName(ticket.sousCategorie.nom);
        return {
          ...ticket,
          estDifficile: points === 30,
        };
      })
    );
  
    const ticketsDifficilesRecus = ticketsDifficiles.filter(t => t.estDifficile).length;
    const ticketsDifficilesResolus = ticketsDifficiles.filter(t => t.estDifficile && t.statut === 3).length;
  
    const tauxRealisation =
      ticketsDifficilesRecus > 0
        ? Math.round((ticketsDifficilesResolus / ticketsDifficilesRecus) * 100)
        : 0;
  
    return {
      agent: nomComplet,
      ticketsDifficilesRecus,
      ticketsDifficilesResolus,
      tauxRealisation: `${tauxRealisation}%`,
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
      id: number;
      nomComplet: string;
      facile: number[];
      moyen: number[];
      difficile: number[];
    }> = {};
  
    for (const agent of tousLesAgents) {
      const idAgent = Number(agent.idAgent);
      tempsParAgent[idAgent] = {
        id: idAgent,
        nomComplet: `${agent.nom} ${agent.prenom}`,
        facile: [],
        moyen: [],
        difficile: [],
      };
    }
  
    const tickets = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.sousCategorie', 'sousCategorie')
      .leftJoinAndSelect('ticket.technicien', 'technicien') // nécessaire pour accéder à ticket.technicien.idAgent
      .where('ticket.statut = :resolu', { resolu: 3 })
      .andWhere('ticket.dateCreation BETWEEN :debut AND :fin', { debut: dateDebut, fin: dateFin })
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
  
      if (points === 10) tempsParAgent[idAgent].facile.push(dureeResolution);
      else if (points === 20) tempsParAgent[idAgent].moyen.push(dureeResolution);
      else if (points === 30) tempsParAgent[idAgent].difficile.push(dureeResolution);
    }
  
    const convertirMsEnHeuresMinutes = (ms: number) => {
      const heures = Math.floor(ms / 3600000);
      const minutes = Math.floor((ms % 3600000) / 60000);
      return `${heures}h ${minutes}min`;
    };
  
    const calculerMoyenne = (tableau: number[]) =>
      tableau.length ? tableau.reduce((a, b) => a + b, 0) / tableau.length : 0;
  
    const resultats = Object.values(tempsParAgent)
      .map(agent => ({
        id: agent.id,
        agent: agent.nomComplet,
        tempsMoyenFacile: convertirMsEnHeuresMinutes(calculerMoyenne(agent.facile)),
        tempsMoyenMoyen: convertirMsEnHeuresMinutes(calculerMoyenne(agent.moyen)),
        tempsMoyenDifficile: convertirMsEnHeuresMinutes(calculerMoyenne(agent.difficile)),
      }))
      .sort((a, b) => a.id - b.id);
  
    return resultats;
  }
      
  

}
