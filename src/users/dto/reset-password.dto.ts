import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'E-mail do usuário para reset de senha',
    example: 'exemplo@rocketcorp.com',
  })
  @IsEmail()
  email: string;
}