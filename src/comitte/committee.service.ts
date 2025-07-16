import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  EvaluationCriterion,
  LeaderEvaluation,
  PeerEvaluation,
  Prisma,
  Project,
  SelfEvaluation,
  User,
  UserType,
} from '@prisma/client';
import { EncryptionService } from 'src/common/encryption/encryption.service';
import { EqualizationService } from 'src/rh/equalization.service';
import { TeamMemberDto } from 'src/team/dto/team-info.dto';
import * as XLSX from 'xlsx';
import { GenAIService } from '../gen-ai/gen-ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { GetCommitteePanelQueryDto } from './dto/get-committee-panel-query.dto';
import { UpdateCommitteeEvaluationDto } from './dto/update-committee-evaluation.dto';
import { CommitteInsightsInfo, CycleCommitteInsightsInfoDto } from './dto/committee-insights.dto';

export interface CommitteeSummary {
  readyEvaluations: number;
  overallAverage: number;
  totalCollaborators: number;
  pendingEvaluations: number;
}

@Injectable()
export class CommitteeService {
 constructor(
    private prisma: PrismaService,
    private genAIService: GenAIService,
    private equalizationService: EqualizationService,
    private encryptionService: EncryptionService,
  ) {}

  private async getLastCycleId(): Promise<string> {
    const lastCycle = await this.prisma.evaluationCycle.findFirst({
      orderBy: { startDate: 'desc' },
      select: { id: true },
    });
    if (!lastCycle) {
      throw new NotFoundException('Nenhum ciclo de avaliação foi encontrado.');
    }
    return lastCycle.id;
  }

  async getLastCycleSummary(): Promise<CommitteeSummary> {
    const cycleId = await this.getLastCycleId();

    const [totalCollaborators, leaderEvaluations, selfEvaluations] = await Promise.all([
this.prisma.user.count({
  where: {
    isActive: true,
    NOT: {
      userType: 'ADMIN',
    },
  },
}),
      this.prisma.leaderEvaluation.findMany({ where: { cycleId } }),
      this.prisma.selfEvaluation.findMany({ where: { cycleId, submissionStatus: 'Concluída' } }),
    ]);

    let totalScore = 0;
    if (leaderEvaluations.length > 0) {
        leaderEvaluations.forEach(ev => {
            totalScore += ev.deliveryScore + ev.proactivityScore + ev.collaborationScore + ev.skillScore;
        });
    }
   
    const overallAverage = leaderEvaluations.length > 0 ? parseFloat((totalScore / (leaderEvaluations.length * 4)).toFixed(2)) : 0;

    const readyEvaluations = new Set(selfEvaluations.map(ev => ev.userId)).size;
    const pendingEvaluations = totalCollaborators - readyEvaluations;

    return {
      totalCollaborators,
      readyEvaluations,
      pendingEvaluations: pendingEvaluations < 0 ? 0 : pendingEvaluations,
      overallAverage,
    };
  }

    async getCommitteInsights(): Promise<CommitteInsightsInfo> {
    const cycles = await this.prisma.evaluationCycle.findMany({
      orderBy: { startDate: 'desc' },
    });

    if (cycles.length === 0) {
      throw new NotFoundException('Nenhum ciclo de avaliação foi encontrado.');
    }

    const cyclesInsights: CycleCommitteInsightsInfoDto[] = [];
    let totalScoreSum = 0;
    let totalLeaderEvaluationsCount = 0;
    let totalProjectsAmount = 0;

    const activeCollaborators = await this.prisma.user.count({
      where: { isActive: true, NOT: { userType: 'ADMIN' } },
    });

    for (const cycle of cycles) {
      const [leaderEvaluations, selfEvaluations, projectsInCycle] = await Promise.all([
        this.prisma.leaderEvaluation.findMany({ where: { cycleId: cycle.id } }),
        this.prisma.selfEvaluation.findMany({ where: { cycleId: cycle.id, submissionStatus: 'Concluído' } }),
        this.prisma.project.count({ where: { cycleId: cycle.id } }),
      ]);

      let cycleTotalScore = 0;
      if (leaderEvaluations.length > 0) {
        leaderEvaluations.forEach(ev => {
          cycleTotalScore += ev.deliveryScore + ev.proactivityScore + ev.collaborationScore + ev.skillScore;
        });
        totalScoreSum += cycleTotalScore;
        totalLeaderEvaluationsCount += leaderEvaluations.length;
      }

      const cycleOverallAverage = leaderEvaluations.length > 0
        ? parseFloat((cycleTotalScore / (leaderEvaluations.length * 4)).toFixed(2))
        : 0;

      const readyEvaluations = new Set(selfEvaluations.map(ev => ev.userId)).size;
      const pendingEvaluations = activeCollaborators - readyEvaluations;

      cyclesInsights.push({
        cycleId: cycle.id,
        cycleName: cycle.name,
        overallAverage: cycleOverallAverage,
        totalCollaborators: activeCollaborators,
        readyEvaluations,
        pendingEvaluations: pendingEvaluations < 0 ? 0 : pendingEvaluations,
        projectsInCycle,
      });

      totalProjectsAmount += projectsInCycle;
    }

    const activeCycle = cycles.find(c => c.status === 'Aberto');
    const activeProjects = activeCycle
      ? await this.prisma.project.count({ where: { cycleId: activeCycle.id } })
      : 0;

    const overallScore = totalLeaderEvaluationsCount > 0
      ? parseFloat((totalScoreSum / (totalLeaderEvaluationsCount * 4)).toFixed(2))
      : 0;

    return {
      cycles: cyclesInsights,
      cyclesAmount: cycles.length,
      score: overallScore,
      projectsAmount: totalProjectsAmount,
      activeProjects,
      activeCollaborators,
    };
  }


  async exportCycleDataForExcel(cycleId: string): Promise<{ fileName: string; buffer: Buffer }> {
    const cycle = await this.prisma.evaluationCycle.findUnique({
      where: { id: cycleId },
    });
    if (!cycle) {
      throw new NotFoundException(`Ciclo com ID ${cycleId} não encontrado.`);
    }

    const [selfEvaluations, leaderEvaluations, peerEvaluations] = await Promise.all([
      this.prisma.selfEvaluation.findMany({
        where: { cycleId, submissionStatus: 'Concluída' },
        include: { user: true, criterion: true },
      }),
      this.prisma.leaderEvaluation.findMany({
        where: { cycleId },
        include: { collaborator: true, leader: true },
      }),
      this.prisma.peerEvaluation.findMany({
        where: { cycleId },
        include: {
          evaluatedUser: true,
          evaluatorUser: true,
          Project: true,
        },
      }),
    ]);

    const consolidatedData = new Map<string, any>();

    const getOrCreateCollaboratorEntry = (user: { id: string; name: string; email: string }) => {
      if (!consolidatedData.has(user.id)) {
        consolidatedData.set(user.id, {
          'Nome Colaborador': user.name,
          'Email Colaborador': user.email,
        });
      }
      return consolidatedData.get(user.id);
    };

    (selfEvaluations as (SelfEvaluation & { user: User; criterion: EvaluationCriterion })[]).forEach(ev => {
      const entry = getOrCreateCollaboratorEntry(ev.user);
      entry[`Autoavaliação - ${ev.criterion.criterionName}`] = ev.score;
      entry['Autoavaliação - Justificativas'] = `${entry['Autoavaliação - Justificativas'] || ''}${
        ev.criterion.criterionName
      }: ${this.encryptionService.decrypt(ev.justification)}\n`;
    });

    (leaderEvaluations as (LeaderEvaluation & { collaborator: User; leader: User })[]).forEach(
      ev => {
        const entry = getOrCreateCollaboratorEntry(ev.collaborator);
        entry['Aval. Líder - Entregas'] = ev.deliveryScore;
        entry['Aval. Líder - Proatividade'] = ev.proactivityScore;
        entry['Aval. Líder - Colaboração'] = ev.collaborationScore;
        entry['Aval. Líder - Habilidades'] = ev.skillScore;
        entry['Aval. Líder - Justificativa'] = this.encryptionService.decrypt(ev.justification) || '';
      },
    );

    const peerAggregations = (
      peerEvaluations as (PeerEvaluation & { evaluatedUser: User | null; evaluatorUser: User; Project: Project | null })[]
    ).reduce((acc, ev) => {
      if (!ev.evaluatedUser) return acc;
      const evaluatedId = ev.evaluatedUser.id;
      if (!acc[evaluatedId]) {
        acc[evaluatedId] = {
          scores: [],
          pointsToImprove: [],
          pointsToExplore: [],
          user: ev.evaluatedUser,
        };
      }
      acc[evaluatedId].scores.push(ev.generalScore);
      acc[evaluatedId].pointsToImprove.push(`- ${this.encryptionService.decrypt(ev.pointsToImprove)} (Avaliador: ${ev.evaluatorUser.name})`);
      acc[evaluatedId].pointsToExplore.push(`- ${this.encryptionService.decrypt(ev.pointsToExplore)} (Avaliador: ${ev.evaluatorUser.name})`);
      return acc;
    }, {} as Record<string, any>);

    Object.values(peerAggregations).forEach((agg: any) => {
      const entry = getOrCreateCollaboratorEntry(agg.user);
      const averageScore = agg.scores.length > 0 ? agg.scores.reduce((a, b) => a + b, 0) / agg.scores.length : 0;
      entry['Média Geral (Pares)'] = parseFloat(averageScore.toFixed(2));
      entry['Pontos a Melhorar (Pares)'] = agg.pointsToImprove.join('\n');
      entry['Pontos a Explorar (Pares)'] = agg.pointsToExplore.join('\n');
    });

    const finalDataForExcel = Array.from(consolidatedData.values());
    if (finalDataForExcel.length === 0) {
      return { fileName: `nenhuma_avaliacao_Concluida.xlsx`, buffer: Buffer.from('') };
    }

    const worksheet = XLSX.utils.json_to_sheet(finalDataForExcel);

    if (worksheet['!ref']) {
      worksheet['!autofilter'] = { ref: worksheet['!ref'] };
    }

    const columnWidths = Object.keys(finalDataForExcel[0] || {}).map(key => {
      let maxWidth = 40;
      const minWidth = key.length + 2;
      const contentWidth = finalDataForExcel.reduce((w, r) => Math.max(w, (r[key] || '').toString().length), 0);
      const finalWidth = Math.min(maxWidth, Math.max(minWidth, contentWidth + 2));
      return { wch: finalWidth };
    });
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Avaliacoes Consolidadas');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    return {
      fileName: `export_avaliacoes_${cycle.name.replace(/\s/g, '_')}.xlsx`,
      buffer: buffer,
    };
  }

  async getCommitteePanel(query: GetCommitteePanelQueryDto) {
    const { page = 1, limit = 10, cycleId: queryCycleId, search, track } = query;

    const cycleId = queryCycleId || (await this.getLastCycleId());
    const cycle = await this.prisma.evaluationCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException(`Ciclo com ID ${cycleId} não encontrado.`);

    const whereClause: Prisma.UserWhereInput = {
      isActive: true,
    };

    if (search) {
      whereClause.name = { contains: search };
    }

    if (track) {
      whereClause.roles = {
        some: {
          name: { contains: track },
          type: 'TRILHA',
        },
      };
    }

    const allFilteredCollaborators = await this.prisma.user.findMany({
      where: whereClause,
      include: {
        roles: { where: { type: 'CARGO' } },
        leader: true,
      },
      orderBy: { name: 'asc' },
    });

    const evaluationsData = await Promise.all(
      allFilteredCollaborators.map(async user => {
        if (!user.leaderId && user.userType !== UserType.GESTOR && user.userType !==UserType.RH){
            return null;
        }
       
        const [selfEvals, peerEvals, leaderEval, directReportEval, finalizedEval, equalizationLog, aiSummary] = await Promise.all([
          this.prisma.selfEvaluation.findMany({ where: { userId: user.id, cycleId }, select: { score: true } }),
          this.prisma.peerEvaluation.findMany({ where: { evaluatedUserId: user.id, cycleId }, select: { generalScore: true } }),
          this.prisma.leaderEvaluation.findFirst({ where: { collaboratorId: user.id, cycleId } }),
          user.leaderId ? this.prisma.directReportEvaluation.findFirst({ where: { collaboratorId: user.id, leaderId: user.leaderId, cycleId } }) : Promise.resolve(null),
          this.prisma.finalizedEvaluation.findFirst({ where: { collaboratorId: user.id, cycleId, criterionId: 'geral' } }),
          this.prisma.equalizationLog.findFirst({ where: { collaboratorId: user.id, cycleId, changeType: 'Observação' }, orderBy: { createdAt: 'desc' } }),
          this.prisma.aISummary.findFirst({ where: { collaboratorId: user.id, cycleId: cycleId, summaryType: 'EQUALIZATION_SUMMARY' }, orderBy: { createdAt: 'desc' } }),
        ]);

        const selfEvaluationScore = selfEvals.length > 0 ? parseFloat((selfEvals.reduce((acc, ev) => acc + ev.score, 0) / selfEvals.length).toFixed(1)) : null;
        const peerEvaluationScore = peerEvals.length > 0 ? parseFloat((peerEvals.reduce((acc, ev) => acc + ev.generalScore, 0) / peerEvals.length).toFixed(1)) : null;

        let managerEvaluationScore: number | null = null;
        if (leaderEval) {
            const sum = leaderEval.deliveryScore + leaderEval.proactivityScore + leaderEval.collaborationScore + leaderEval.skillScore;
            managerEvaluationScore = parseFloat((sum / 4).toFixed(1));
        }

        let directReportScore: number | null = null;
        if (directReportEval) {
            const sum = directReportEval.visionScore + directReportEval.inspirationScore + directReportEval.developmentScore + directReportEval.feedbackScore;
            directReportScore = parseFloat((sum / 4).toFixed(1));
        }
       
        const isCollaborator = user.userType === UserType.COLABORADOR;
        const areCollaboratorEvalsMissing = isCollaborator && (managerEvaluationScore === null || directReportScore === null);

        if (selfEvaluationScore === null || peerEvaluationScore === null || areCollaboratorEvalsMissing) {
          return null;
        }

        const status = (finalizedEval && finalizedEval.finalScore > 0) ? 'Equalizada' : 'Pendente';

        return {
          id: `${user.id}_${cycleId}`,
          collaboratorName: user.name,
          collaboratorRole: user.roles[0]?.name || 'N/A',
          collaboratorId: user.id,
          cycleName: cycle.name,
          cycleId: cycle.id,
          selfEvaluationScore,
          peerEvaluationScore,
          managerEvaluationScore,
          directReportScore,
          finalScore: finalizedEval?.finalScore || null,
          status: status,
          observation: equalizationLog ? this.encryptionService.decrypt(equalizationLog.observation) : null,
          genAiSummary: aiSummary ? this.encryptionService.decrypt(aiSummary.content) : null,
        };
      }),
    );
   
    const completedEvaluations = evaluationsData.filter(evaluation => evaluation !== null);
    const totalItems = completedEvaluations.length;
    const totalPages = Math.ceil(totalItems / limit);
    const paginatedData = completedEvaluations.slice((page - 1) * limit, page * limit);

    return {
      evaluations: paginatedData,
      pagination: { totalItems, totalPages, currentPage: page },
    };
  }

  async setMentor(userId: string, mentorId: string | null): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`Colaborador com ID ${userId} não encontrado.`);
    }

    if (mentorId) {
      const mentor = await this.prisma.user.findUnique({
        where: { id: mentorId },
      });

      if (!mentor) {
        throw new NotFoundException(`Mentor com ID ${mentorId} não encontrado.`);
      }
  
    if (mentor.userType !== UserType.COMITE && mentor.userType !== UserType.ADMIN) {
        throw new ForbiddenException(`O usuário ${mentor.name} não tem a permissão 'COMITE' para ser um mentor.`);
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { mentorId: mentorId },
    });
      
    const { passwordHash, ...result } = updatedUser;
    return { ...result, passwordHash: undefined };
  }

  async getSingleAiSummary(evaluationId: string, requestor: User): Promise<{ summary: string }> {
    const [collaboratorId, cycleId] = evaluationId.split('_');
    if (!collaboratorId || !cycleId) {
      throw new BadRequestException('ID da avaliação inválido.');
    }

    const existingSummary = await this.prisma.aISummary.findFirst({
      where: {
        collaboratorId,
        cycleId,
        summaryType: 'EQUALIZATION_SUMMARY',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingSummary) {
      return { summary: this.encryptionService.decrypt(existingSummary.content) };
    }

    const consolidatedView = await this.equalizationService.getConsolidatedView(collaboratorId, cycleId);
    if (!consolidatedView) {
      throw new NotFoundException('Dados de avaliação para este colaborador e ciclo não foram encontrados.');
    }

    const summary = await this.genAIService.generateEqualizationSummary(consolidatedView);

    await this.prisma.aISummary.create({
      data: {
        summaryType: 'EQUALIZATION_SUMMARY',
        content: this.encryptionService.encrypt(summary),
        collaboratorId,
        cycleId,
        generatedById: requestor.id,
      },
    });

    return { summary };
  }
 
  async updateCommitteeEvaluation(
    evaluationId: string,
    dto: UpdateCommitteeEvaluationDto,
    committeeMemberId: string,
  ) {
    const [collaboratorId, cycleId] = evaluationId.split('_');
    if (!collaboratorId || !cycleId) {
      throw new BadRequestException('ID da avaliação inválido. Formato esperado: "userId_cycleId".');
    }

    const transactionPayload: Prisma.PrismaPromise<any>[] = [];

    if (dto.finalScore !== undefined) {
      const criterionId = 'geral';
      await this.prisma.evaluationCriterion.upsert({
        where: { id: criterionId },
        update: {},
        create: {
          id: criterionId,
          pillar: 'Comitê',
          criterionName: 'Nota Final do Comitê',
        },
      });

      transactionPayload.push(
        this.prisma.finalizedEvaluation.upsert({
          where: { collaboratorId_cycleId_criterionId: { collaboratorId, cycleId, criterionId } },
          update: { finalScore: dto.finalScore, finalizedById: committeeMemberId },
          create: {
            collaboratorId,
            cycleId,
            criterionId,
            finalScore: dto.finalScore,
            finalizedById: committeeMemberId,
          },
        }),
      );
    }

    if (dto.observation !== undefined) {
      const existingLog = await this.prisma.equalizationLog.findFirst({
        where: {
          collaboratorId,
          cycleId,
          changeType: 'Observação',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const encryptedObservation = dto.observation
        ? this.encryptionService.encrypt(dto.observation)
        : null;

      if (existingLog) {
        transactionPayload.push(
          this.prisma.equalizationLog.update({
            where: { id: existingLog.id },
            data: {
              observation: encryptedObservation,
              changedById: committeeMemberId,
            },
          }),
        );
      } else if (dto.observation) {
        transactionPayload.push(
          this.prisma.equalizationLog.create({
            data: {
              changeType: 'Observação',
              observation: encryptedObservation,
              changedById: committeeMemberId,
              collaboratorId,
              cycleId,
            },
          }),
        );
      }
    }

    if (transactionPayload.length === 0) {
      throw new BadRequestException('Nenhum dado válido para atualização foi fornecido.');
    }

    await this.prisma.$transaction(transactionPayload);

    return { message: `Avaliação para o colaborador ID ${collaboratorId} foi atualizada com sucesso.` };
  }
  async getMenteesByMentor(mentorId: string): Promise<TeamMemberDto[]> {
    const mentorWithMentees = await this.prisma.user.findUnique({
      where: { id: mentorId },
      include: {
        mentees: {
          select: {
            id: true,
            name: true,
            email: true,
          },
          orderBy: {
            name: 'asc'
          }
        },
      },
    });

    if (!mentorWithMentees) {
      throw new NotFoundException(`Mentor com ID ${mentorId} não encontrado.`);
    }

    return mentorWithMentees.mentees;
  }
   async removeMentor(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`Colaborador com ID ${userId} não encontrado.`);
    }

    if (!user.mentorId) {
      const { passwordHash, ...result } = user;
      return result;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { mentorId: null },
    });

    const { passwordHash, ...result } = updatedUser;
    return result;
  }
}