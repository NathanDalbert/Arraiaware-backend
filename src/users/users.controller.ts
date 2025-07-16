import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Request, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserType } from '@prisma/client';
import { Audit } from 'src/AuditModule/dto/audit.decorator';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Audit('CREATE_USER')
  @Roles(UserType.ADMIN, UserType.RH)
  @ApiOperation({ summary: 'Criar um novo usuário' })
  @ApiResponse({ status: 201, description: 'O usuário foi criado com sucesso.'})
  @ApiResponse({ status: 400, description: 'Parâmetros inválidos.'})
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN, UserType.RH, UserType.GESTOR,UserType.COLABORADOR)
  @ApiOperation({ summary: 'Listar todos os usuários' })
  @ApiResponse({ status: 200, description: 'Lista de usuários retornada com sucesso.'})
  findAll() {
    return this.usersService.findAll();
  }

  @Get('paginated')
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN, UserType.RH)
  @ApiOperation({ summary: 'Listar usuários com paginação e filtros' })
  @ApiResponse({ status: 200, description: 'Lista de usuários retornada com sucesso.'})
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filtra por status ativo (true) ou inativo (false)',
  })
  findPaginated(@Query() queryDto: GetUsersQueryDto) {
    return this.usersService.findPaginated(queryDto);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar um usuário pelo ID' })
  @ApiResponse({ status: 200, description: 'Usuário encontrado.'})
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.'})
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN, UserType.RH)
  @ApiOperation({ summary: 'Atualizar um usuário pelo ID' })
  @ApiResponse({ status: 200, description: 'Usuário atualizado com sucesso.'})
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.'})
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Audit('DELETE_USER')
  @Roles(UserType.ADMIN, UserType.RH)
  @ApiOperation({ summary: 'Deletar um usuário pelo ID' })
  @ApiResponse({ status: 200, description: 'Usuário deletado com sucesso.'})
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.'})
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }

  @Patch('me/change-password')
  @ApiBearerAuth()
  @Audit('RESET_USER_PASSWORD')
  @ApiOperation({ summary: 'Alterar a senha do usuário logado' })
  @ApiResponse({ status: 200, description: 'Senha alterada com sucesso.'})
  @ApiResponse({ status: 401, description: 'A senha atual está incorreta.'})
  changeMyPassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Usuário não autenticado.');
    }
    return this.usersService.changePassword(userId, changePasswordDto);
  }

  @Patch(':id/reset-password')
  @UseGuards(RolesGuard)
  @Audit('RESET_USER_PASSWORD')
  @ApiOperation({ summary: 'Resetar a senha de um usuário' })
  @ApiResponse({ status: 200, description: 'Senha resetada e enviada por e-mail com sucesso.'})
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.'})
  resetPassword(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.resetPassword(id);
  }

  @Get(':id/evaluation-history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar o histórico de avaliações de um usuário para um ciclo' })
  @ApiQuery({ name: 'cycleId', type: 'string', description: 'ID do ciclo de avaliação', required: true })
  @ApiResponse({ status: 200, description: 'Histórico de avaliações retornado com sucesso.' })
  @ApiResponse({ status: 404, description: 'Usuário ou histórico não encontrado.' })
  getEvaluationHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    return this.usersService.getEvaluationHistory(id, cycleId);
  }

  @Get(':id/cycles')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar os ciclos de avaliação em que um usuário participou' })
  @ApiResponse({ status: 200, description: 'Lista de ciclos retornada com sucesso.'})
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.'})
  findUserCycles(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findUserCycles(id);
  }
}
