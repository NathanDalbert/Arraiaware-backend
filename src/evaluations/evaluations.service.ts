import { Injectable, NotFoundException } from '@nestjs/common';
import { EncryptionService } from '../common/encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { LeaderEvaluationRecordDto } from './dto/leader-evaluation-record.dto';
import { SubmitDirectReportEvaluationDto } from './dto/submit-direct-report-evaluation.dto';
import { SubmitLeaderEvaluationDto } from './dto/submit-leader-evaluation.dto';
import { SubmitPeerEvaluationDto } from './dto/submit-peer-evaluation.dto';
import { SubmitReferenceIndicationDto } from './dto/submit-reference-indication.dto';
import { SubmitSelfEvaluationDto } from './dto/submit-self-evaluation.dto';

const leaderCriteria = [
  {
    id: 'leader-criterion-delivery',
    pillar: 'Execução',
    criterionName: 'Qualidade e pontualidade das entregas',
    description: 'Avalia a capacidade de entregar tarefas com alta qualidade e dentro dos prazos acordados.',
    scoreField: 'deliveryScore',
  },
  {
    id: 'leader-criterion-proactivity',
    pillar: 'Comportamento',
    criterionName: 'Proatividade e iniciativa',
    description: 'Avalia a capacidade de antecipar problemas, propor soluções e agir sem necessidade de supervisão constante.',
    scoreField: 'proactivityScore',
  },
  {
    id: 'leader-criterion-collaboration',
    pillar: 'Comportamento',
    criterionName: 'Colaboração e trabalho em equipe',
    description: 'Avalia a habilidade de trabalhar de forma eficaz com outros membros da equipe para alcançar objetivos comuns.',
    scoreField: 'collaborationScore',
  },
  {
    id: 'leader-criterion-skill',
    pillar: 'Técnico',
    criterionName: 'Habilidades técnicas e de negócio',
    description: 'Avalia o domínio das ferramentas e conhecimentos necessários para a função, bem como o entendimento do negócio.',
    scoreField: 'skillScore',
  },
];

@Injectable()
export class EvaluationsService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  async submitSelfEvaluation(dto: SubmitSelfEvaluationDto) {
    const { userId, cycleId, evaluations } = dto;

    const dataToCreate = evaluations.map((ev) => ({
      userId,
      cycleId,
      criterionId: ev.criterionId,
      score: ev.score,
      justification: this.encryptionService.encrypt(ev.justification),
      scoreDescription: this.encryptionService.encrypt(ev.scoreDescription),
      submissionStatus: 'Concluída',
    }));

    return this.prisma.$transaction(
      dataToCreate.map((data) =>
        this.prisma.selfEvaluation.upsert({
          where: {
            userId_cycleId_criterionId: {
              userId: data.userId,
              cycleId: data.cycleId,
              criterionId: data.criterionId,
            },
          },
          update: data,
          create: data,
        }),
      ),
    );
  }

  async submitPeerEvaluation(dto: SubmitPeerEvaluationDto) {
    if (dto.evaluatedUserId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.evaluatedUserId } });
      if (!user) throw new NotFoundException(`Utilizador avaliado com ID ${dto.evaluatedUserId} não encontrado.`);
    }
    if (dto.projectId) {
      const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
      if (!project) {
        throw new NotFoundException(`Projeto com ID ${dto.projectId} não encontrado.`);
      }
    }

    const encryptedDto = {
      ...dto,
      pointsToImprove: this.encryptionService.encrypt(dto.pointsToImprove),
      pointsToExplore: this.encryptionService.encrypt(dto.pointsToExplore),
      motivatedToWorkAgain: this.encryptionService.encrypt(dto.motivatedToWorkAgain),
    };

    return this.prisma.peerEvaluation.create({ data: encryptedDto });
  }

  async submitReferenceIndication(dto: SubmitReferenceIndicationDto) {
    if (dto.indicatedUserId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.indicatedUserId } });
      if (!user) throw new NotFoundException(`Utilizador indicado com ID ${dto.indicatedUserId} não encontrado.`);
    }

    const encryptedDto = {
      ...dto,
      justification: this.encryptionService.encrypt(dto.justification),
    };

    return this.prisma.referenceIndication.create({ data: encryptedDto });
  }

  async submitLeaderEvaluation(dto: SubmitLeaderEvaluationDto) {
    const { collaboratorId, leaderId, cycleId, justification, ...scores } = dto;

    const users = await this.prisma.user.findMany({
      where: { id: { in: [collaboratorId, leaderId] } },
    });
    if (users.length !== 2) {
      throw new NotFoundException('Colaborador ou líder não encontrado.');
    }

    const encryptedData = {
      ...scores,
      justification: this.encryptionService.encrypt(justification),
    };

    return this.prisma.leaderEvaluation.upsert({
      where: {
        leaderId_collaboratorId_cycleId: {
          leaderId,
          collaboratorId,
          cycleId,
        },
      },
      update: encryptedData,
      create: {
        leaderId,
        collaboratorId,
        cycleId,
        ...encryptedData,
      },
    });
  }

  async submitDirectReportEvaluation(dto: SubmitDirectReportEvaluationDto) {
    const { collaboratorId, leaderId, cycleId, ...scores } = dto;

    const users = await this.prisma.user.findMany({
      where: { id: { in: [collaboratorId, leaderId] } },
    });
    if (users.length !== 2) {
      throw new NotFoundException('Colaborador ou líder não encontrado.');
    }

    return this.prisma.directReportEvaluation.upsert({
      where: {
        collaboratorId_leaderId_cycleId: {
          collaboratorId,
          leaderId,
          cycleId,
        },
      },
      update: {
        ...scores,
      },
      create: {
        collaboratorId,
        leaderId,
        cycleId,
        ...scores,
      },
    });
  }

  async findSelfEvaluation(userId: string, cycleId: string) {
    const evaluations = await this.prisma.selfEvaluation.findMany({
      where: { userId, cycleId },
      include: { criterion: true },
    });

    if (!evaluations || evaluations.length === 0) {
      throw new NotFoundException('Autoavaliação não encontrada para este utilizador e ciclo.');
    }

    return evaluations.map((ev) => ({
      ...ev,
      justification: this.encryptionService.decrypt(ev.justification),
      scoreDescription: this.encryptionService.decrypt(ev.scoreDescription),
    }));
  }

  async findPeerEvaluationsForUser(evaluatedUserId: string, cycleId: string) {
    const evaluations = await this.prisma.peerEvaluation.findMany({
      where: { evaluatedUserId, cycleId },
      include: {
        evaluatorUser: { select: { id: true, name: true } },
      },
    });

    return evaluations.map((ev) => ({
      ...ev,
      pointsToImprove: this.encryptionService.decrypt(ev.pointsToImprove),
      pointsToExplore: this.encryptionService.decrypt(ev.pointsToExplore),
      motivatedToWorkAgain: this.encryptionService.decrypt(ev.motivatedToWorkAgain),
    }));
  }

  async findReferenceIndicationsForUser(indicatorUserId: string, cycleId: string) {
    const indications = await this.prisma.referenceIndication.findMany({
      where: { indicatorUserId, cycleId },
      include: {
        indicatedUser: { select: { id: true, name: true } },
      },
    });

    return indications.map((ind) => ({
      ...ind,
      justification: this.encryptionService.decrypt(ind.justification),
    }));
  }
  
  async findReferenceReceivedForUser(indicatedUserId: string, cycleId: string) {
    const indications = await this.prisma.referenceIndication.findMany({
      where: { indicatedUserId, cycleId },
      include: {
        indicatedUser: { select: { id: true, name: true } },
      },
    });

    return indications.map((ind) => ({
      ...ind,
      justification: this.encryptionService.decrypt(ind.justification),
    }));
  }

  async findLeaderEvaluationsForDirectReports(leaderId: string, cycleId: string) {
    const evaluations = await this.prisma.leaderEvaluation.findMany({
      where: {
        leaderId,
        cycleId,
      },
      include: {
        collaborator: { select: { id: true, name: true, email: true } },
      },
    });

    if (!evaluations) {
      throw new NotFoundException(
        `Nenhuma avaliação de líder encontrada para o líder com ID ${leaderId} no ciclo ${cycleId}.`,
      );
    }

    return evaluations.map((ev) => ({
      ...ev,
      justification: this.encryptionService.decrypt(ev.justification),
    }));
  }

  async findLeaderEvaluationForCollaborator(userId: string, cycleId: string): Promise<LeaderEvaluationRecordDto[]> {
    const evaluation = await this.prisma.leaderEvaluation.findFirst({
      where: {
        collaboratorId: userId,
        cycleId: cycleId,
      },
      include: {
        leader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!evaluation) {
      throw new NotFoundException(
        `Nenhuma avaliação de líder encontrada para o colaborador com ID ${userId} no ciclo ${cycleId}.`,
      );
    }

    const decryptedJustification = this.encryptionService.decrypt(evaluation.justification);

    const records: LeaderEvaluationRecordDto[] = leaderCriteria.map(criterion => {
      return {
        id: `${evaluation.id}-${criterion.id}`,
        collaboratorId: evaluation.collaboratorId,
        cycleId: evaluation.cycleId,
        score: evaluation[criterion.scoreField],
        scoreDescription: `Nota de ${evaluation[criterion.scoreField]} atribuída pelo líder.`,
        justification: decryptedJustification,
        criterion: {
          id: criterion.id,
          pillar: criterion.pillar,
          criterionName: criterion.criterionName,
          description: criterion.description,
        },
        leader: evaluation.leader,
      };
    });

    return records;
  }

  async getUserStatus(userId: string, cycleId: string) {
    const selfEvaluationDone = await this.prisma.selfEvaluation.findFirst({
      where: { userId, cycleId },
    });

    return {
      userId,
      cycleId,
      status: selfEvaluationDone ? 'Concluído' : 'Pendente',
    };
  }

  async findAllPeerEvaluations(cycleId?: string) {
    const evaluations = await this.prisma.peerEvaluation.findMany({
      where: {
        cycleId: cycleId,
      },
      include: {
        evaluatorUser: {
          select: { id: true, name: true, email: true },
        },
        evaluatedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return evaluations.map((ev) => ({
      ...ev,
      pointsToImprove: this.encryptionService.decrypt(ev.pointsToImprove),
      pointsToExplore: this.encryptionService.decrypt(ev.pointsToExplore),
      motivatedToWorkAgain: this.encryptionService.decrypt(ev.motivatedToWorkAgain),
    }));
  }

  async findPeerEvaluationsDoneByUser(evaluatorUserId: string, cycleId: string) {
    const evaluations = await this.prisma.peerEvaluation.findMany({
      where: { evaluatorUserId, cycleId },
      include: {
        evaluatedUser: { select: { id: true, name: true } },
      },
    });

    return evaluations.map((ev) => ({
      ...ev,
      pointsToImprove: this.encryptionService.decrypt(ev.pointsToImprove),
      pointsToExplore: this.encryptionService.decrypt(ev.pointsToExplore),
      motivatedToWorkAgain: this.encryptionService.decrypt(ev.motivatedToWorkAgain),
    }));
  }

  async findReferenceIndicationsDoneByUser(indicatorUserId: string, cycleId: string) {
    const indications = await this.prisma.referenceIndication.findMany({
      where: { indicatorUserId, cycleId },
      include: {
        indicatedUser: { select: { id: true, name: true } },
      },
    });

    return indications.map((ind) => ({
      ...ind,
      justification: this.encryptionService.decrypt(ind.justification),
    }));
  }
}
