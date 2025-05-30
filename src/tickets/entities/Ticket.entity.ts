import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Agent } from '../../agents/entities/Agent.entity';
import { SousCategorie } from '../../sous-categories/entities/SousCategorie.entity';

@Entity('tincidents')
export class Ticket {
  @PrimaryGeneratedColumn({ name: 'id' })
  idTicket: number;

  @ManyToOne(() => SousCategorie)
  @JoinColumn({ name: 'subcat' })
  sousCategorie: SousCategorie;


  @Column({ name: 'state' })
  statut: number;

  @Column({ name: 'date_create' })
  dateCreation: Date;

  @Column({ name: 'date_res' })
  dateResolution: Date;

  @ManyToOne(() => Agent, (agent) => agent.tickets)
  @JoinColumn({ name: "technician" })
  technicien: Agent;
}