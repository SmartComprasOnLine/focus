# Focus - Assistente de Produtividade e Rotina

Um assistente pessoal inteligente via WhatsApp focado em ajudar pessoas a manterem uma rotina produtiva e equilibrada. O sistema atua como um coach pessoal, auxiliando na organização do tempo, gestão de atividades e manutenção do equilíbrio entre trabalho e vida pessoal.

## Principais Funcionalidades

### 1. Gestão Inteligente de Rotina
- Criação de planos personalizados considerando:
  - Horários de trabalho fixos
  - Compromissos específicos por dia da semana
  - Necessidades de descanso e pausas
  - Equilíbrio trabalho-família
- Adaptação dinâmica do plano conforme feedback

### 2. Sistema de Lembretes Inteligentes
- Lembretes estratégicos para cada atividade:
  - Preparação (5 minutos antes)
  - Início da atividade
  - Acompanhamento e conclusão
- Suporte para diferentes agendas por dia
- Configuração flexível de frequência
- Mensagens motivacionais personalizadas

### 3. Acompanhamento de Progresso
- Feedback após cada atividade
- Ajustes baseados no desempenho
- Sugestões de melhorias
- Análise de padrões de produtividade

### 4. Assistente Pessoal IA
- Interação natural via WhatsApp
- Respostas contextualizadas
- Sugestões personalizadas
- Adaptação às necessidades individuais

## Benefícios

- 🎯 Melhor gestão do tempo
- ⚖️ Equilíbrio trabalho-vida
- 📈 Aumento de produtividade
- 🧘‍♂️ Redução de estresse
- 💪 Desenvolvimento de hábitos saudáveis

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

4. Inicie o servidor:
```bash
npm start
```

## Planos

### Teste Gratuito (7 dias)
- Acesso a todas as funcionalidades
- Plano personalizado
- Lembretes ilimitados

### Assinatura
- Mensal: R$ 99,00
- Anual: R$ 999,00 (economia de 2 meses)
- Suporte contínuo
- Ajustes ilimitados

## Como Funciona

1. **Primeira Interação**
   - Análise inicial da rotina
   - Criação do plano personalizado
   - Configuração dos lembretes

2. **Uso Diário**
   - Lembretes nos momentos certos
   - Acompanhamento de atividades
   - Ajustes conforme necessário

3. **Evolução Contínua**
   - Análise de padrões
   - Sugestões de melhorias
   - Adaptação às mudanças

## Estrutura do Projeto

```
src/
├── controllers/        # Controladores da aplicação
├── models/            # Modelos do MongoDB
├── routes/            # Rotas da API
├── services/          # Serviços principais
│   ├── openaiService.js       # Integração com IA
│   ├── reminderService.js     # Gestão de lembretes
│   ├── evolutionApi.js        # Integração WhatsApp
│   └── stripeService.js       # Pagamentos
└── scripts/           # Scripts utilitários
```

## Contribuição

1. Faça um Fork do projeto
2. Crie uma Branch para sua Feature (`git checkout -b feature/NovaFuncionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a Branch (`git push origin feature/NovaFuncionalidade`)
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
