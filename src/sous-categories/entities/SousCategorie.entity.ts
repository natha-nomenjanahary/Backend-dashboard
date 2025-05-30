import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Ticket } from '../../tickets/entities/Ticket.entity';

@Entity('tsubcat')
export class SousCategorie {
  @PrimaryGeneratedColumn({ name: 'id' })
  idCategorie: number;

  @Column({ name: 'name' })
  nom: string;

  @OneToMany(() => Ticket, (ticket) => ticket.sousCategorie)
  tickets: Ticket[];
}