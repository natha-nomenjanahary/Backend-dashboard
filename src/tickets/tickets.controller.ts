import { Controller, Get, Query } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { DateQueryDto } from './dto/date-query.dto';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  //1.Statut des tickets par jour en 1mois
  @Get('statut-par-jour')
  getStatutTicketsParJourExcluantWeekends(@Query() query: DateQueryDto) {
    return this.ticketsService.getStatutTicketsParJourExcluantWeekends(query.mois, query.annee);
  }

  //2.Info de ces tickets par mois
  @Get('statuts-par-agent')
  getStatutTicketsParAgent(@Query() query: DateQueryDto) {
    return this.ticketsService.getStatutTicketsParAgent(query);
  }

  //3.tickets repartis pour les 5 derniers mois
  @Get('les-5-dernier')
  getTicketsRepartisParMois(
    @Query('mois') mois?: string,
    @Query('annee') annee?: string,
  ) {
    const parsedMois = mois ? parseInt(mois, 10) : undefined;
    const parsedAnnee = annee ? parseInt(annee, 10) : undefined;

    return this.ticketsService.getTicketsRepartisParMois(parsedMois, parsedAnnee);
  }

}


