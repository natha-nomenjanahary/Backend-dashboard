import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SousCategorie } from './entities/SousCategorie.entity';

@Injectable()
export class SousCategorieService {
  constructor(
    @InjectRepository(SousCategorie)
    private readonly sousCategorieRepository: Repository<SousCategorie>,
  ) {}

  async findAll(): Promise<SousCategorie[]> {
    return this.sousCategorieRepository.find();
  }

  async getPointsByName(name: string): Promise<number> {
    const normalizedName = this.normalizeSousCategorie(name); // Définir ici
    const sousCategorie = await this.sousCategorieRepository.findOne({
      where: { nom: normalizedName }, // Assure-toi que la colonne s'appelle bien `libelle` dans ton entité
    });
    return sousCategorie?.points ?? 30;
  }

  normalizeSousCategorie(sousCategorie: string | null | undefined): string {
    if (!sousCategorie) return 'inconnue';
    return sousCategorie
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Correction de la regex
      .replace(/[^a-z0-9 ]/g, '');
  }
}
