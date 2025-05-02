import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Ticket } from './entities/Ticket.entity';

@Injectable()
export class TicketsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) {}

  // 1. Tickets avec agents
  async getTicketsAvecAgents(): Promise<{ categorie: string; agentId: number; agentName: string }[]> {
    const rows = await this.dataSource.query(`
      SELECT
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
  async getTicketsRealisesParAgent(): Promise<{ agentId: number, agentName: string, total: number }[]> {
    const rows = await this.dataSource.query(`
      SELECT 
        i.technician AS agentId,
        CONCAT(u.firstname, ' ', u.lastname) AS agentName,
        COUNT(*) AS total
      FROM tincidents i
      LEFT JOIN tusers u ON i.technician = u.id
      WHERE i.technician IS NOT NULL AND i.state = 3
      GROUP BY i.technician
    `);

    return rows;
  }

  // 3. Statut des tickets par agent
  async getStatutTicketsParAgent() {
    return await this.ticketRepository
      .createQueryBuilder('ticket')
      .select('ticket.technician', 'agentId')
      .addSelect([
        `SUM(CASE WHEN ticket.state = 4 THEN 1 ELSE 0 END) AS nbFermes`,
        `SUM(CASE WHEN ticket.state = 1 THEN 1 ELSE 0 END) AS nbOuverts`,
        `SUM(CASE WHEN ticket.state = 2 THEN 1 ELSE 0 END) AS nbEnCours`
      ])
      .groupBy('ticket.technician')
      .getRawMany();
  }
}
