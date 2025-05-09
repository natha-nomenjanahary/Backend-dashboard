import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tsubcat')
export class SousCategorie {
  @PrimaryGeneratedColumn({ name: 'id' })
  idCategorie: number;

  @Column({ name: 'name' })
  nom: string;

  @Column()
  points: number ;
}