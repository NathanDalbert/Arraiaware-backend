import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT');
    
    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false, 
      tls: {
        rejectUnauthorized: false 
      }
    });

    this.logger.log('Nodemailer transporter configurado para MailHog.');
    this.logger.log(`Conectando a: ${smtpHost}:${smtpPort}`);
  }

  async sendWelcomeEmail(to: string, initialPassword: string) {
    const mailOptions = {
        from: `"Plataforma RPE" <${this.configService.get<string>('SMTP_FROM_EMAIL', 'noreply@rpe.com')}>`,
        to: to,
        subject: 'Bem-vindo à Plataforma de Avaliação RPE!',
        html: `
            <h1>Bem-vindo(a) à Rocket Corp!</h1>
            <p>Sua conta na nossa plataforma de avaliação de desempenho (RPE) foi criada.</p>
            <p>Você pode acessar o sistema usando seu email e a senha temporária abaixo:</p>
            <p><b>Senha Temporária:</b> ${initialPassword}</p>
            <p>Recomendamos que você altere sua senha no primeiro acesso.</p>
            <br>
            <p>Atenciosamente,</p>
            <p>Equipe Rocket Corp.</p>
        `,
    };

    try {
        const info = await this.transporter.sendMail(mailOptions);
        this.logger.log(`Email de boas-vindas enviado com sucesso para: ${to}. Mensagem ID: ${info.messageId}`);
    } catch (error) {
        this.logger.error(`Erro ao enviar email de boas-vindas para ${to}: ${error.message}`, error.stack);
    }
  }

  async sendBrutalFactsEmail(to: string, mentorName: string, menteeName: string, cycleName: string, brutalFacts: string) {
    this.logger.log(`[EMAIL DEBUG] Tentando enviar email de 'Brutal Facts' para ${to}`);
    
    const mailOptions = {
        from: `"Plataforma RPE" <${this.configService.get<string>('SMTP_FROM_EMAIL', 'noreply@rpe.com')}>`,
        to: to,
        subject: `[RPE] Pontos de Foco para o PDI de ${menteeName}`,
        html: `
            <h1>Olá, ${mentorName}!</h1>
            <p>O processo de equalização para o ciclo <strong>${cycleName}</strong> foi concluído para <strong>${menteeName}</strong>.</p>
            <p>Abaixo estão os pontos de foco ("Brutal Facts") extraídos para auxiliar na criação do Plano de Desenvolvimento Individual (PDI) e na sua próxima sessão de feedback:</p>
            <div style="background-color: #f5f5f5; border-left: 4px solid #f0ad4e; padding: 15px; margin-top: 15px;">
              ${brutalFacts.replace(/\n/g, '<br>')}
            </div>
            <br>
            <p>Utilize estes insights para guiar uma conversa produtiva e focada no desenvolvimento.</p>
            <p>Atenciosamente,</p>
            <p>Equipe Rocket Corp.</p>
        `,
    };

    try {
        const info = await this.transporter.sendMail(mailOptions);
        this.logger.log(`Email de Brutal Facts enviado com sucesso para: ${to}. Mensagem ID: ${info.messageId}`);
    } catch (error) {
        this.logger.error(`Erro ao enviar email de Brutal Facts para ${to}: ${error.message}`, error.stack);
    }
  }
}