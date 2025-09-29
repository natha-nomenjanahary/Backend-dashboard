import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Ticket } from '../../tickets/entities/Ticket.entity';

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

  @OneToMany(() => Ticket, (ticket) => ticket.technicien)
  tickets: Ticket[];

  // -------- nouveaux champs --------
  @Column({ name: 'password', type: 'varchar', length: 512, nullable: true })
  password?: string;

  @Column({ name: 'role', type: 'varchar', length: 50, default: 'agent' })
  role: string;
}
