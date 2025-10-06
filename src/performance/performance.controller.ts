import { Controller, Get, Query } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { TicketsService } from '../tickets/tickets.service';
import { AgentsService } from '../agents/agents.service';
import { SousCategorieService } from '../sous-categories/sous-categories.service';
import { ScoreParAgent } from '../sous-categories/sous-categories.service';

export interface TicketWithAgent {
  idTicket: number;
  date_create: Date;
  state: number;
  sousCategorieNom: string;
  agentId: number;
  agentName: string;
}

interface AgentScore {
  agentId: number;
  agentName: string;
  moisActuel: number;
  moisDernier: number;
}

@Controller('performance')
export class PerformanceController {
  constructor(
    private readonly performanceService: PerformanceService,
    private readonly ticketService: TicketsService, 
    private readonly agentService: AgentsService,
    private readonly sousCategorieService: SousCategorieService,
  ) {}

  //1.score par agent
  @Get('scores-agents')
  async getScoresParAgent(
    @Query('mois') mois?: number,
    @Query('annee') annee?: number,
  ): Promise<AgentScore[]> {
    return this.sousCategorieService.calculerScoreParAgent(
      mois ? Number(mois) : undefined,
      annee ? Number(annee) : undefined,
    );
  }


  //2.repartition par mois en pourcentage
  @Get('tickets-repartis-par-agent')
  async getRepartitionParAgent(
    @Query('mois') mois?: number,
    @Query('annee') annee?: number,
  ) {
    return this.performanceService.getRepartitionTicketsParAgentParMois(mois, annee);
  }


  //3.ticket realise par agent
  @Get('tickets-realises-agents')
  async getTicketsRealisesParAgent(
    @Query('mois') mois?: number,
    @Query('annee') annee?: number,
  ) {
    return await this.ticketService.getTicketsRealisesParAgent(mois,annee);
  }

  //4.Taux de réalisation par mois(total)
  @Get('tickets-realises-par-mois')
  async getTicketsRealisesEnUnMois(
    @Query('mois') mois?: number,
    @Query('annee') annee?: number,
  ){
    return this.performanceService.calculerTauxResolutionMensuel(mois,annee);
  }

  //5. Ces tickets realises par agents(f,m,d)
  @Get('tickets-realises-info-difficulte-par-agent')
  async calculerResolutionParAgentParMois(
    @Query('mois') mois?: number,
    @Query('annee') annee?: number,
  ){
    return this.performanceService.calculerResolutionParAgentParMois(mois,annee);
  }

  //6.  temps de realisation FACILE
  @Get('temps-realisation-par-agent')
  async calculerTempsMoyenResolutionParAgent(
    @Query('mois') mois?: number,
    @Query('annee') annee?: number,
  ){
    return this.performanceService.calculerTempsMoyenResolutionParComplexiteParAgent(mois,annee);
  }

  //9. 17. Tableau de forte qctivité
  @Get('forte-activite')
  async obtenirTicketsEnCoursDes10MoisPrecedents(
    @Query('mois') mois?: number,
    @Query('annee') annee?: number,
  ){
    return this.performanceService.obtenirTicketsEnCoursDes10MoisPrecedents(mois,annee);
  }

  //10. liste des tickets realisés
  @Get('ticket-de')
  async getTicketsRealisesParId(
    @Query('idAgent') idAgent: number,
    @Query('mois') mois?: number,
    @Query('annee') annee?: number,
  ){
    return this.performanceService.getTicketsRealisesParId(idAgent, mois, annee);
  }

  //11.Temps par semaine d'un agent 
  @Get('temps-semaine')
  async calculerTempsMoyenParSemainePourAgentTicket(
    @Query('idAgent') idAgent: number,
    @Query('mois') mois?: number,
    @Query('annee') annee?: number,
  ){
    return this.performanceService.calculerTempsMoyenParSemaineParComplexitePourAgent(idAgent, mois,annee);
  }

  
  //14.Taux de realisation d'un agent 
  @Get('taux-de')
  async getStatistiquesTicketsFacilesParAgent(
    @Query('idAgent') idAgent: number,
    @Query('mois') mois?: number,
    @Query('annee') annee?: number,
  ){
    return this.performanceService.getStatistiquesTicketsParComplexite(idAgent, mois,annee);
  }
  
  
  // //17. Periode forte activité
  // @Get('forte-activite-point')
  // async obtenirPointsTicketsEnCoursDes10MoisPrecedents(
  //   @Query('mois') mois?: number,
  //   @Query('annee') annee?: number,
  // ){
  //   return this.performanceService.obtenirPointsTicketsEnCoursDes10MoisPrecedents(mois,annee);
  // }

  //18. Temps de resolution de tous les agnets
  @Get('temps-de-tout-le-monde')
  async getTempsMoyenResolutionParComplexiteEtAgent(
    @Query('mois') mois?: number,
    @Query('annee') annee?: number,
  ){
    return this.performanceService.getTempsMoyenResolutionParComplexiteEtAgent(mois,annee);
  }

  //19.Classement
  @Get('classement')
  async getClassementAgents(
    @Query('mois') mois?: number,
    @Query('annee') annee?: number,
  ){
    return this.performanceService.getClassementAgents(mois,annee);
  }

  //20.Recherche
  @Get('chercher')
  async rechercherParIdentifiantOuNom(
    @Query('terme') terme: string,
  ) {
    const termeFinal: string | number = !isNaN(Number(terme)) ? Number(terme) : terme;
    return this.performanceService.rechercherParIdentifiantOuNom(termeFinal);
  }

  
}
