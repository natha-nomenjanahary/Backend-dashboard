import { Test, TestingModule } from '@nestjs/testing';
import { SousCategorieService } from './sous-categories.service';

describe('SousCategoriesService', () => {
  let service: SousCategorieService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SousCategorieService],
    }).compile();

    service = module.get<SousCategorieService>(SousCategorieService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
