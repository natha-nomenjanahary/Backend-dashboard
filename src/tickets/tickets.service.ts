import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class TicketsService {
  constructor(private readonly dataSource: DataSource) {}

  //Nbre de tickets par chaque agent 
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

  //Nbre de tickets réalisés par chaque agent
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
}
