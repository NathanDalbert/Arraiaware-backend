import { Module } from '@nestjs/common';
import { CyclesModule } from '../cycles/cycles.module'; 
import { PrismaModule } from '../prisma/prisma.module';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [PrismaModule, CyclesModule], 
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}