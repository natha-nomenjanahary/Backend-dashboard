// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../agents/entities/Agent.entity';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Agent)
    private agentRepo: Repository<Agent>,
    private jwtService: JwtService,
  ) {}

  // 🔹 Validation login par ID + mot de passe
  async validateAdminById(
    id: number,
    plainPassword: string,
  ): Promise<Agent> {
    const agent = await this.agentRepo.findOne({
      where: { idAgent: id },
    });

    if (!agent) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Vérifie le mot de passe
    const matched = await bcrypt.compare(plainPassword, agent.password || '');
    if (!matched) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Vérifie le rôle
    if (agent.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    return agent;
  }

  // 🔹 Création JWT
  async login(agent: Agent) {
    // Ici tu définis le payload du token
    const payload = {
      sub: agent.idAgent,     // identifiant unique
      role: agent.role,       // rôle (admin, chef de service, etc.)
      function: agent.poste,  // poste/fonction
      name: agent.prenom,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
