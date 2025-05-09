import { Test, TestingModule } from '@nestjs/testing';
import { SousCategoriesService } from './sous-categories.service';

describe('SousCategoriesService', () => {
  let service: SousCategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SousCategoriesService],
    }).compile();

    service = module.get<SousCategoriesService>(SousCategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
