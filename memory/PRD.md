# Niveli - PRD (Product Requirements Document)

## Visão Geral
Niveli é um app minimalista de decisão financeira que responde: **"Quanto posso gastar hoje com segurança?"**

## Stack Técnico
- **Frontend**: React Native (Expo SDK 54) com expo-router
- **Backend**: FastAPI (Python) 
- **Banco de dados**: MongoDB
- **Autenticação**: Nenhuma (dados por dispositivo via device_id)
- **Moeda**: BRL (R$) apenas
- **Idioma**: Português (Brasil)

## Telas

### 1. Tela de Setup (`/setup`)
- Input de renda mensal (R$)
- Input de despesas fixas mensais (R$)
- Botão "Começar"
- Logo Niveli centralizada

### 2. Tela Home (`/home`)
- **Hero**: "Você pode gastar hoje: R$ X" (destaque principal)
- Restante no mês: R$ X
- Dias restantes: X
- Contador de streak (dias consecutivos com atividade)
- Botão "Adicionar gasto" (primário)
- Botão "Não gastei nada hoje" (secundário)
- Ícone de configurações (engrenagem)
- Mensagens de feedback (economia/aviso)

### 3. Tela Adicionar Gasto (`/add-expense`)
- Botões rápidos: +10, +20, +50
- Campo de input manual
- Botão "Salvar"
- Botão voltar

## Lógica Principal
```
free_money = income - fixed_expenses
total_spent = soma de todas despesas do mês atual
remaining = free_money - total_spent
days_left = dias_no_mês - dia_atual + 1
daily_available = remaining / days_left
```

## Gamificação
- Streak: incrementa se usuário registra atividade diariamente
- Reset de streak se pular um dia
- Mensagens de feedback baseadas no gasto

## API Endpoints
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/device/setup` | Criar/atualizar perfil |
| GET | `/api/device/{id}/profile` | Buscar perfil |
| POST | `/api/device/{id}/expense` | Adicionar gasto |
| POST | `/api/device/{id}/no-spend` | Registrar dia sem gasto |
| GET | `/api/device/{id}/summary` | Resumo financeiro completo |

## Coleções MongoDB
- `profiles`: device_id, income, fixed_expenses
- `expenses`: device_id, amount, date
- `activities`: device_id, date, type (expense/no_spend)

## Design System
- **Primary**: #F5C518 (amarelo dourado)
- **Text**: #1A2E1A (verde escuro)
- **Background**: #FEFCF5 (creme)
- **Surface**: #FFFFFF
- **Estilo**: Classical Minimalism

## Sugestões Futuras (NÃO implementadas)
- Autenticação com Google
- Histórico mensal de gastos
- Notificações push diárias
- Compartilhamento social de streaks
- Modo escuro
- **Monetização**: Plano premium com insights AI de gastos (R$9,90/mês)
