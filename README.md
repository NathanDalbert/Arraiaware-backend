# 🚀 RPE - Rocket Performance & Engagement (Backend)

![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=prisma&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Swagger](https://img.shields.io/badge/Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)

Backend da plataforma RPE, uma solução digital completa para centralizar e automatizar a avaliação de desempenho e o engajamento dos colaboradores da Rocket Corp.

---

## 👋 Novo por aqui?

Confira o guia de **ONBOARDING** para começar!

---

## 🎯 Sobre o Projeto

A empresa Rocket Corp enfrenta desafios com seu processo de avaliação de desempenho, que é manual, fragmentado e suscetível a vieses. A ausência de uma plataforma integrada dificulta a análise de dados e a tomada de decisões estratégicas sobre promoções e treinamentos.

O **RPE** (Rocket Performance and Engagement) foi criado para resolver esses problemas, oferecendo uma abordagem estruturada e baseada em dados, que garante avaliações mais justas, eficientes e alinhadas com os objetivos da organização.

---

## ✨ Funcionalidades

A plataforma evoluiu para além do MVP inicial e agora conta com um ecossistema robusto de módulos para uma gestão de performance completa:

---

### 🧩 Módulos Principais

#### Gestão de Usuários (Users)
- CRUD completo para colaboradores, gestores e administradores.
- Sistema de tipos de usuário: `COLABORADOR`, `GESTOR`, `RH`, `ADMIN`.
- Alteração e reset de senhas com envio de e-mail.

#### Autenticação e Segurança (Auth)
- Autenticação baseada em **JWT** (`passport-jwt`).
- Hashing de senhas com **bcrypt**.
- Guardas de rota para controle de acesso por tipo de usuário (**RBAC**).

#### Gestão de Cargos e Trilhas (Roles)
- CRUD para papéis e trilhas de desenvolvimento.
- Associação de critérios específicos por cargo/trilha.

#### Gestão de Critérios (Criteria)
- CRUD para critérios de avaliação.
- Sistema de pilares: **Comportamento**, **Execução**, **Gestão**, **Liderança**.
- Suporte para atualização em massa via planilhas XLSX.

#### Gestão de Ciclos (Cycles)
- Criação, gerenciamento e fechamento de ciclos de avaliação.

---

## 📈 Processo de Avaliação

#### Submissão de Avaliações (Evaluations)
- Autoavaliação baseada em critérios.
- Avaliação 360° (pares, líderes).
- Feedback de liderados.
- Indicação de referências.

#### Gestão de Projetos e Times (Projects & Team)
- Criação de projetos e associação de colaboradores.
- Facilita avaliação de pares no contexto de trabalho real.

---

## 🧑‍💼 Módulos de Gestão e RH

#### Dashboard do Gestor (Dashboard)
- Acompanhamento do progresso das avaliações da equipe em tempo real.

#### Painel do RH (RH)
- Visão global de todas as avaliações.
- Filtros avançados e exportação de dados.

#### Importação de Dados (Import)
- Importação de usuários em massa via planilhas XLSX.
- Importação de histórico de avaliações anteriores.

#### Equalização e Comitê (Equalization & Committee)
- Visualização e ajuste de notas finais por comitê.
- Exportação de dados consolidados para tomada de decisão.
- Geração de "Brutal Facts" para mentoria.

---

## 🤖 Automação e Inteligência

#### Sincronização com ERP (ERP)
- **Cron Job** diário para sincronização de dados com sistema ERP externo.

#### Integração com IA Generativa (GenAI)
- API do **Google Gemini** para gerar resumos analíticos.
- Auxilia comitês e mentores nos feedbacks.

#### Sistema de Notificações (Notifications)
- Envio de e-mails transacionais com **Nodemailer**.
- Ex: Criação de conta, envio de resumo de avaliações, notificações de ciclo.

#### Auditoria (Audit)
- Registro de ações críticas no sistema para rastreabilidade.

---

## 🛠️ Tecnologias Utilizadas

| Categoria         | Tecnologia         |
|------------------|--------------------|
| Framework        | NestJS             |
| ORM              | Prisma             |
| Linguagem        | TypeScript         |
| Banco de Dados   | SQLite (dev)       |
| Documentação     | Swagger (OpenAPI)  |
| Segurança        | Bcrypt, Passport.js|
| IA Generativa    | Google Gemini      |
| E-mails          | Nodemailer         |
| Pacotes          | pnpm               |

---

## 🚀 Começando

### ✅ Pré-requisitos

- Node.js (versão 18 ou superior)
- pnpm instalado globalmente:
```bash
npm install -g pnpm
```

---

### 📦 Instalação

Clone o repositório:

```bash
git clone https://github.com/belli5/Arraiaware-backend.git
cd Arraiaware-backend
```

Crie e configure o arquivo `.env`:

```bash
cp .env.example .env
```

Edite o `.env` com:
- Credenciais do banco de dados
- Chave secreta JWT
- Chave da API do Gemini

Instale as dependências:

```bash
pnpm install
```

Execute as migrações do banco de dados:

```bash
pnpm prisma migrate dev
```

---

### ▶️ Executando a Aplicação

Inicie o servidor em modo desenvolvimento (hot-reload):

```bash
pnpm start:dev
```

A aplicação estará disponível em: [http://localhost:3000](http://localhost:3000)

Documentação Swagger: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

Simulador de E-mails (**MailHog**): veja `docker-compose.yml` para acesso ao painel.

---

## 🧑‍💻 Autoria

Desenvolvido por **Arraiware Team** 🚀
