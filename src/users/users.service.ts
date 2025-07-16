import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { email, name, userType, unidade, roleIds, leaderId } = createUserDto;
    let password = createUserDto.password;
    let passwordToSend: string | null = null;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException(`O e-mail '${email}' já está em uso.`);
    }

    if (!password) {
      const generatedPassword = randomBytes(8).toString('hex');
      password = generatedPassword;
      passwordToSend = generatedPassword;
    }

    const saltOrRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltOrRounds);

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        userType,
        unidade,
        leaderId,
        roles: {
          connect: roleIds?.map(id => ({ id })),
        },
      },
    });

    if (passwordToSend) {
      await this.emailService.sendWelcomeEmail(user.email, passwordToSend);
    }

    const { passwordHash: _, ...result } = user;
    return result;
  }
  
  async createAdmin(adminData: { name: string; email: string; userType: any; unidade: string; }) {
    const { email, name, userType, unidade } = adminData;
    
    const saltOrRounds = 10;
    const generatedPassword = randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(generatedPassword, saltOrRounds);

    await this.prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        userType,
        unidade,
      },
    });
    
    return generatedPassword; 
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: {
        roles: true,
        leader: true,
      },
    });
    return users.map((user) => {
      const { passwordHash, ...result } = user;
      return result;
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: true, leader: true },
    });

    if (!user) {
      throw new NotFoundException(`Usuário com ID ${id} não encontrado`);
    }

    const { passwordHash: _, ...result } = user;
    return result;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id);
    const { roleIds, ...otherData } = updateUserDto;

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...otherData,
        ...(roleIds && {
          roles: {
            set: roleIds.map(id => ({ id })),
          },
        }),
      },
    });

    const { passwordHash: _, ...result } = updatedUser;
    return result;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { message: `Usuário com ID ${id} removido com sucesso.` };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: true,
      },
    });
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`Usuário com ID ${userId} não encontrado.`);
    }

    const isPasswordMatching = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );

    if (!isPasswordMatching) {
      throw new UnauthorizedException('A senha atual está incorreta.');
    }

    const isSameAsOldPassword = await bcrypt.compare(
      changePasswordDto.newPassword,
      user.passwordHash,
    );

    if (isSameAsOldPassword) {
      throw new BadRequestException('A nova senha não pode ser igual à senha atual.');
    }
    
    const saltOrRounds = 10;
    const newPasswordHash = await bcrypt.hash(changePasswordDto.newPassword, saltOrRounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return { message: 'Senha alterada com sucesso.' };
  }

  async resetPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException(`Usuário com e-mail ${email} não encontrado`);
    }

    const newPassword = randomBytes(8).toString('hex');
    const saltOrRounds = 10;
    
    const newPasswordHash = await bcrypt.hash(newPassword, saltOrRounds);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    await this.emailService.sendWelcomeEmail(user.email, newPassword);

    return { message: `Uma nova senha temporária foi enviada para o e-mail ${user.email}.` };
  }

  async getEvaluationHistory(userId: string, cycleId: string) {
    await this.findOne(userId);

    const selfEvaluation = this.prisma.selfEvaluation.findMany({
      where: { userId, cycleId },
      include: { criterion: true },
    });

    const peerEvaluations = this.prisma.peerEvaluation.findMany({
      where: { evaluatedUserId: userId, cycleId },
      include: { evaluatorUser: { select: { id: true, name: true } } },
    });

    const leaderEvaluations = this.prisma.leaderEvaluation.findMany({
      where: { collaboratorId: userId, cycleId },
      include: {
        leader: { select: { id: true, name: true } },
      },
    });

    const [self, peers, leaders] = await Promise.all([
      selfEvaluation,
      peerEvaluations,
      leaderEvaluations,
    ]);

    if (self.length === 0 && peers.length === 0 && leaders.length === 0) {
      throw new NotFoundException(
        `Nenhum histórico de avaliação encontrado para o usuário com ID ${userId} no ciclo ${cycleId}.`,
      );
    }

    return {
      selfEvaluation: self,
      peerEvaluations: peers,
      leaderEvaluations: leaders,
    };
  }

  async findUserCycles(userId: string) {
    await this.findOne(userId);

    const [
      selfEvaluationCycles,
      peerEvaluationCycles,
      leaderEvaluationCycles,
      directReportEvaluationCycles,
      referenceIndicationCycles,
    ] = await Promise.all([
      this.prisma.selfEvaluation.findMany({
        where: { userId },
        select: { cycleId: true },
        distinct: ['cycleId'],
      }),
      this.prisma.peerEvaluation.findMany({
        where: { OR: [{ evaluatedUserId: userId }, { evaluatorUserId: userId }] },
        select: { cycleId: true },
        distinct: ['cycleId'],
      }),
      this.prisma.leaderEvaluation.findMany({
        where: { OR: [{ collaboratorId: userId }, { leaderId: userId }] },
        select: { cycleId: true },
        distinct: ['cycleId'],
      }),
      this.prisma.directReportEvaluation.findMany({
        where: { OR: [{ collaboratorId: userId }, { leaderId: userId }] },
        select: { cycleId: true },
        distinct: ['cycleId'],
      }),
      this.prisma.referenceIndication.findMany({
        where: { OR: [{ indicatedUserId: userId }, { indicatorUserId: userId }] },
        select: { cycleId: true },
        distinct: ['cycleId'],
      }),
    ]);

    const allCycleIds = new Set([
      ...selfEvaluationCycles.map(e => e.cycleId),
      ...peerEvaluationCycles.map(e => e.cycleId),
      ...leaderEvaluationCycles.map(e => e.cycleId),
      ...directReportEvaluationCycles.map(e => e.cycleId),
      ...referenceIndicationCycles.map(e => e.cycleId),
    ]);

    const cycles = await this.prisma.evaluationCycle.findMany({
      where: {
        id: { in: [...allCycleIds] },
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    return cycles;
  }

  async findPaginated(queryDto: GetUsersQueryDto) {
    const { page = 1, limit = 10, search, userType, isActive } = queryDto;

    const where: Prisma.UserWhereInput = {};

    if (isActive === 'true') {
      where.isActive = true;
    } else if (isActive === 'false') {
      where.isActive = false;
    }

    if (search) {
      where.OR = [
        { name: { contains: search} },
        { email: { contains: search} },
      ];
    }

    if (userType) {
      where.userType = userType;
    }

    const [users, totalItems] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: {
          roles: true,
          leader: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          name: 'asc',
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: users.map(user => {
        const { passwordHash, ...result } = user;
        return result;
      }),
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
      },
    };
  }
}