import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
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

  async validateAdminById(id: number, plainPassword: string): Promise<Agent> {
    const agent = await this.agentRepo.findOne({ where: { idAgent: id } });
    if (!agent) throw new UnauthorizedException('Invalid credentials');

    if (!agent.password) throw new UnauthorizedException('Password not set for this user');

    const matched = await bcrypt.compare(plainPassword, agent.password);
    if (!matched) throw new UnauthorizedException('Invalid credentials');

    // Vérifier que c'est un admin (optionnel: aussi accepter function 'Chef de service')
    if (agent.role !== 'admin' && agent.poste !== 'Chef de service') {
      throw new ForbiddenException('Access denied');
    }

    return agent;
  }

  async login(agent: Agent) {
    const payload = { sub: agent.idAgent, role: agent.role, function: agent.poste, name: agent.prenom };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
