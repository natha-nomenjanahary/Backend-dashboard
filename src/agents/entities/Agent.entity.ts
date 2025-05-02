import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { Ticket } from '../../tickets/entities/Ticket.entity'

@Entity('tusers')
export class Agent {
  @PrimaryGeneratedColumn({ name: 'id' })
  idAgent: number;

  @Column({ name: 'lastname' })
  nom: string;

  @Column({ name: 'firstname' })
  prenom: string;

  @Column({ name: 'function' })
  poste: string;

  @Column({ name: 'phone', nullable: true })
  tel: number;

  @Column({ name: 'mail' })
  email: string;
  
}
