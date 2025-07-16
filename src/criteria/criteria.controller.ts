import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';
import { Audit } from 'src/AuditModule/dto/audit.decorator';
import { CriteriaService } from './criteria.service';
import { AssociateCriterionDto } from './dto/associate-criterion.dto';
import { CreateCriterionDto } from './dto/create-criterion.dto';
import { DisassociateCriterionDto } from './dto/disassociate-criterion.dto';
import { UpdateCriterionDto } from './dto/update-criterion.dto';
import { AssociateCriteriaToRoleDto } from './dto/associate-criteria-to-role.dto';

@ApiTags('Criteria')
@Controller('api/criteria')
export class CriteriaController {
  constructor(private readonly criteriaService: CriteriaService) {}

  @Patch('batch-update')
  @HttpCode(HttpStatus.OK)
  @Audit('BATCH_UPDATE_CRITERIA')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Atualiza nomes e corrige pilares de critérios em massa a partir de um XLSX' })
  @ApiResponse({ status: 200, description: 'Critérios processados com sucesso.' })
  @ApiResponse({ status: 400, description: 'Arquivo inválido ou dados malformados.' })
  @ApiBody({
    description: 'Planilha XLSX com as colunas "Critério Antigo" e "Critério Novo"',
    required: true,
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async batchUpdate(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        ],
      }),
    ) 
    file: Express.Multer.File
  ) {
    return this.criteriaService.batchUpdateFromXlsx(file);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar um novo critério de avaliação' })
  @ApiResponse({ status: 201, description: 'Critério criado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Dados inválidos ou critério já existe.' })
  async create(@Body() createCriterionDto: CreateCriterionDto) {
    return this.criteriaService.create(createCriterionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os critérios de avaliação' })
  @ApiResponse({ status: 200, description: 'Lista de critérios retornada com sucesso.' })
  async findAll() {
    return this.criteriaService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar um critério pelo ID' })
  @ApiResponse({ status: 200, description: 'Critério encontrado.' })
  @ApiResponse({ status: 404, description: 'Critério não encontrado.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.criteriaService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar um critério' })
  @ApiResponse({ status: 200, description: 'Critério atualizado com sucesso.' })
  @ApiResponse({ status: 404, description: 'Critério não encontrado.' })
  @ApiResponse({ status: 400, description: 'Dados inválidos.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateCriterionDto: UpdateCriterionDto
  ) {
    return this.criteriaService.update(id, updateCriterionDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletar um critério' })
  @ApiResponse({ status: 204, description: 'Critério deletado com sucesso.' })
  @ApiResponse({ status: 404, description: 'Critério não encontrado.' })
  @ApiResponse({ status: 409, description: 'Critério está em uso e não pode ser deletado.' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.criteriaService.remove(id);
  }

  @Post(':id/associate-role')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Associar um critério a um cargo/trilha' })
  @ApiResponse({ status: 201, description: 'Associação criada com sucesso.' })
  @ApiResponse({ status: 404, description: 'Critério ou Cargo não encontrado.' })
  @ApiResponse({ status: 409, description: 'Associação já existe.' })
  async associateRole(
    @Param('id', ParseUUIDPipe) criterionId: string,
    @Body() associateCriterionDto: AssociateCriterionDto,
  ) {
    return this.criteriaService.associateToRole(criterionId, associateCriterionDto);
  }

  @Post('roles/:roleId/associate-criteria')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Associar múltiplos critérios a um cargo/trilha' })
  @ApiResponse({ status: 201, description: 'Associações criadas com sucesso.' })
  @ApiResponse({ status: 404, description: 'Cargo ou um ou mais Critérios não encontrados.' })
  async associateCriteriaToRole(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() associateCriteriaDto: AssociateCriteriaToRoleDto,
  ) {
    return this.criteriaService.associateCriteriaToRole(roleId, associateCriteriaDto);
  }

  @Put('roles/:roleId/criteria')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sincroniza (define) todos os critérios para um cargo/trilha' })
  @ApiResponse({ status: 200, description: 'Critérios do cargo sincronizados com sucesso.' })
  @ApiResponse({ status: 404, description: 'Cargo ou um dos critérios não encontrado.' })
  async syncRoleCriteria(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() associateCriteriaDto: AssociateCriteriaToRoleDto,
  ) {
    return this.criteriaService.syncRoleCriteria(roleId, associateCriteriaDto);
  }

  @Delete(':id/disassociate-role')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desvincular um critério de um cargo/trilha' })
  @ApiResponse({ status: 204, description: 'Associação removida com sucesso.' })
  @ApiResponse({ status: 404, description: 'Associação não encontrada.' })
  async disassociateRole(
    @Param('id', ParseUUIDPipe) criterionId: string,
    @Body() disassociateDto: DisassociateCriterionDto,
  ) {
    return this.criteriaService.disassociateFromRole(criterionId, disassociateDto);
  }
}