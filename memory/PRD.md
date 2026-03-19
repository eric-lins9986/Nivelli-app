# Niveli - PRD (Product Requirements Document)

## Visão Geral
Niveli é um app minimalista de decisão financeira que responde: **"Quanto posso gastar hoje com segurança?"**

## Stack Técnico
- **Frontend**: React Native (Expo SDK 54) com expo-router e tab navigation
- **Backend**: FastAPI (Python)
- **Banco de dados**: MongoDB
- **Autenticação**: Nenhuma (dados por dispositivo via device_id)
- **Moeda**: BRL (R$) apenas
- **Idioma**: Português (Brasil)

## Telas (7 telas total)

### Navegação por Tabs (4 tabs)

#### Tab 1: Início (`/(tabs)/index`)
- Saldo atual com botão "Atualizar"
- Health status badge (🟢 Saudável / 🟡 Atenção / 🔴 Crítico)
- **Hero**: "Você pode gastar hoje: R$ X"
- Restante no mês / Dias restantes
- Streak badge
- Botões: "Adicionar gasto" e "Não gastei nada hoje"
- Ícone de configurações

#### Tab 2: Contas Fixas (`/(tabs)/fixed-expenses`)
- Barra de comprometimento da renda (% com indicador 🟢/🔴)
- Totais: Pago / Pendente
- Lista de despesas fixas com toggle pago/pendente
- Adicionar / remover itens
- Sincroniza com cálculos gerais

#### Tab 3: Linha do Tempo (`/(tabs)/timeline`)
- Timeline vertical do mês
- Dias passados: gasto + saldo após
- Dia atual: destaque
- Dias futuros: previsão diária + saldo projetado + alerta se zerar

#### Tab 4: Streak (`/(tabs)/streak`)
- Stats: Streak atual, Melhor streak, Dias ativos
- Calendário mensal com 🔥 nos dias ativos
- Legenda visual

### Telas Modal/Stack
- **Setup** (`/setup`) - Renda, despesas fixas, saldo inicial
- **Adicionar Gasto** (`/add-expense`) - Botões rápidos +10/+20/+50 + manual
- **Atualizar Saldo** (`/update-balance`) - Exibe saldo atual + campo novo valor

## Lógica Principal
```
free_money = income - fixed_expenses
daily_available = current_balance / days_left
```
- Adicionar gasto → deduz do current_balance
- Atualizar saldo → recalcula tudo
- Adicionar/remover conta fixa → sincroniza fixed_expenses total

## API Endpoints
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/device/setup` | Criar/atualizar perfil (com balance) |
| GET | `/api/device/{id}/profile` | Buscar perfil |
| PUT | `/api/device/{id}/balance` | Atualizar saldo |
| POST | `/api/device/{id}/expense` | Adicionar gasto (deduz balance) |
| POST | `/api/device/{id}/no-spend` | Registrar dia sem gasto |
| GET | `/api/device/{id}/summary` | Resumo com balance + health |
| POST | `/api/device/{id}/fixed-expenses` | Criar conta fixa |
| GET | `/api/device/{id}/fixed-expenses` | Listar com totais e health |
| PATCH | `/api/device/{id}/fixed-expenses/{item}` | Toggle pago/pendente |
| DELETE | `/api/device/{id}/fixed-expenses/{item}` | Remover conta fixa |
| GET | `/api/device/{id}/timeline` | Timeline do mês |
| GET | `/api/device/{id}/streak-calendar` | Calendário de streak |

## Coleções MongoDB
- `profiles`: device_id, income, fixed_expenses, current_balance
- `expenses`: device_id, amount, date
- `activities`: device_id, date, type (expense/no_spend)
- `fixed_expense_items`: device_id, name, amount, is_paid

## Design System
- **Primary**: #F5C518 (amarelo dourado)
- **Text**: #1A2E1A (verde escuro)
- **Background**: #FEFCF5 (creme)
- **Surface**: #FFFFFF
- **Estilo**: Classical Minimalism com tabs

## Sugestões Futuras (NÃO implementadas)
- Autenticação com Google para sync entre dispositivos
- Histórico mensal comparativo
- Notificações push diárias
- Exportar dados (CSV/PDF)
- Modo escuro
- **Monetização**: Plano premium com insights AI (R$9,90/mês)
