import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AuditLogData {
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: any;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(forwardRef(() => PrismaService))
    private prisma: PrismaService,
  ) {}

  async log(data: AuditLogData) {
    this.logger.log(`Audit Log: User ${data.userId || 'System'} | Action: ${data.action} | Entity: ${data.entity} (${data.entityId || ''})`);

    await this.prisma.auditLog.create({
      data: {
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        userId: data.userId,
        details: data.details || undefined,
        ipAddress: data.ipAddress,
      },
    });
  }
  findAll() {
    return this.prisma.auditLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async exportToCsv(): Promise<string> {
    const logs = await this.findAll();
    if (logs.length === 0) {
      return 'Nenhum registro de auditoria para exportar.';
    }

    const headers = [
      'ID',
      'Ação',
      'ID do Usuário',
      'Nome do Usuário',
      'Email do Usuário',
      'Detalhes',
      'Endereço IP',
      'Data de Criação',
    ].join(',');

    const rows = logs.map(log => {
      const details = log.details ? JSON.stringify(log.details).replace(/"/g, '""') : '';
      return [
        `"${log.id}"`,
        `"${log.action}"`,
        `"${log.userId || 'N/A'}"`,
        `"${log.user?.name || 'Sistema'}"`,
        `"${log.user?.email || 'N/A'}"`,
        `"${details}"`,
        `"${log.ipAddress || 'N/A'}"`,
        `"${log.createdAt.toISOString()}"`,
      ].join(',');
    });

    return [headers, ...rows].join('\n');
  }
}