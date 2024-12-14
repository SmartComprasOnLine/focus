# Focus - TDAH Coach

Um sistema MicroSaaS integrado à Evolution API para WhatsApp, focado em ajudar pessoas com TDAH a organizarem suas rotinas. O sistema atua como um coach pessoal, auxiliando o usuário a melhorar sua produtividade, foco e disposição.

## Funcionalidades

### 1. Gerenciamento de Webhook
- Processamento de eventos da Evolution API (mensagens de texto, áudio e imagem)
- Respostas personalizadas baseadas no tipo de mensagem
- Armazenamento de interações no banco de dados

### 2. Período de Teste Gratuito
- 7 dias de teste gratuito
- Registro automático de novos usuários
- Notificação de término do período de teste
- Transição suave para assinatura paga

### 3. Gestão de Assinaturas
- Integração com Stripe para processamento de pagamentos
- Planos disponíveis:
  - Mensal: R$ 99,00
  - Anual: R$ 999,00 (economia de 2 meses)
- Gerenciamento automático de status de assinatura
- Webhook para confirmação de pagamentos

### 4. Coach Pessoal
- Interação personalizada baseada em IA
- Geração de planos personalizados
- Ajustes dinâmicos no plano
- Sistema de notificações e lembretes

## Tecnologias

- Node.js
- MongoDB
- Evolution API (WhatsApp)
- OpenAI GPT
- Stripe

## Configuração

1. Clone o repositório:
```bash
git clone https://github.com/SmartComprasOnLine/focus.git
cd focus
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:
```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/focus_adhd

# Evolution API
EVOLUTION_API_URL=https://evo.meuchatinteligente.com.br
EVOLUTION_API_KEY=your_api_key
EVOLUTION_INSTANCE=your_instance

# OpenAI
OPENAI_API_KEY=your_openai_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Planos (em centavos)
PLAN_MONTHLY_PRICE=9900
PLAN_YEARLY_PRICE=99900
```

4. Inicie o servidor:
```bash
npm start
```

## Scripts Úteis

- `npm run dev`: Inicia o servidor em modo desenvolvimento
- `node src/scripts/checkTrialEnding.js`: Verifica usuários com trial próximo do fim
- `node src/scripts/checkUserSubscription.js`: Verifica status de assinatura
- `node clearDatabase.js`: Limpa o banco de dados (apenas desenvolvimento)

## Estrutura do Projeto

```
src/
├── controllers/        # Controladores da aplicação
├── models/            # Modelos do MongoDB
├── routes/            # Rotas da API
├── scripts/           # Scripts utilitários
├── services/          # Serviços (Evolution API, Stripe, etc)
└── utils/             # Funções utilitárias
```

## Fluxo do Usuário

1. **Primeira Interação**
   - Mensagem de boas-vindas
   - Registro no banco de dados
   - Início do período de teste

2. **Durante o Teste**
   - Coleta de dados
   - Geração de plano personalizado
   - Envio de notificações

3. **Fim do Teste**
   - Notificação de término
   - Opções de assinatura
   - Processo de pagamento

4. **Assinatura Ativa**
   - Acesso contínuo
   - Suporte do coach
   - Ajustes no plano

## Contribuição

1. Faça um Fork do projeto
2. Crie uma Branch para sua Feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a Branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
