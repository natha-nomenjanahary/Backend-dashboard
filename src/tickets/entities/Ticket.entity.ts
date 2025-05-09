import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Agent } from '../../agents/entities/Agent.entity';


@Entity('tincidents')
export class Ticket {
  @PrimaryGeneratedColumn({ name: 'id' })
  idTicket: number;

  @Column({ name: 'subcat' })
  sousCategorie: number;

  @ManyToOne(() => Agent)
  @JoinColumn({ name: 'technician' })
  technicien: Agent;

  @Column({ name: 'state' })
  statut: string;

  @Column({ name: 'date_create' })
  dateCreation: Date;

  @Column({ name: 'date_res' })
  dateResolution: Date;

  @ManyToOne(() => Agent, (agent) => agent.tickets)
  @JoinColumn({ name: "technician" })
  agent: Agent;
}