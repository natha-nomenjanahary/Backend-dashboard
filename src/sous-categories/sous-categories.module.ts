import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SousCategorie } from './entities/SousCategorie.entity';
import { SousCategorieService } from './sous-categories.service';
import { SousCategoriesController } from './sous-categories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SousCategorie])],
  providers: [SousCategorieService],
  controllers: [SousCategoriesController],
  exports: [SousCategorieService],
})
export class SousCategoriesModule {}
