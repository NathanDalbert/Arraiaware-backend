import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserType } from '@prisma/client';
import { Response } from 'express';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditService } from './audit.service';

@ApiTags('Audit Log')
@Controller('api/audit-logs')
@UseGuards(RolesGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Listar todos os registos de auditoria' })
  findAll() {
    return this.auditService.findAll();
  }

  @Get('export')
  @Roles(UserType.ADMIN)
  @ApiOperation({ summary: 'Exportar todos os registros de auditoria para um arquivo CSV' })
  async exportAudits(@Res() res: Response) {
    const csvData = await this.auditService.exportToCsv();
    const fileName = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;

    res.header('Content-Type', 'text/csv');
    res.attachment(fileName);
    res.send(csvData);
  }
}