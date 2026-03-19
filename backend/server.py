from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import calendar

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# --- Models ---

class SetupInput(BaseModel):
    device_id: str
    income: float
    fixed_expenses: float
    current_balance: Optional[float] = None

class ProfileResponse(BaseModel):
    device_id: str
    income: float
    fixed_expenses: float
    current_balance: float

class BalanceInput(BaseModel):
    current_balance: float

class ExpenseInput(BaseModel):
    amount: float

class FixedExpenseItemInput(BaseModel):
    name: str
    amount: float

class FixedExpenseToggleInput(BaseModel):
    is_paid: bool

class SummaryResponse(BaseModel):
    income: float
    fixed_expenses: float
    current_balance: float
    free_money: float
    total_spent: float
    remaining: float
    days_left: int
    daily_available: float
    streak: int
    today_spent: float
    feedback: str
    health_status: str

# --- Routes ---

@api_router.get("/")
async def root():
    return {"message": "Niveli API"}

@api_router.post("/device/setup", response_model=ProfileResponse)
async def setup_device(input_data: SetupInput):
    now = datetime.now(timezone.utc).isoformat()
    balance = input_data.current_balance if input_data.current_balance is not None else (input_data.income - input_data.fixed_expenses)
    await db.profiles.update_one(
        {"device_id": input_data.device_id},
        {"$set": {
            "device_id": input_data.device_id,
            "income": input_data.income,
            "fixed_expenses": input_data.fixed_expenses,
            "current_balance": balance,
            "updated_at": now
        },
        "$setOnInsert": {"created_at": now}},
        upsert=True
    )
    return ProfileResponse(
        device_id=input_data.device_id,
        income=input_data.income,
        fixed_expenses=input_data.fixed_expenses,
        current_balance=balance
    )

@api_router.get("/device/{device_id}/profile")
async def get_profile(device_id: str):
    profile = await db.profiles.find_one({"device_id": device_id}, {"_id": 0})
    if not profile:
        return {"exists": False}
    return {
        "exists": True,
        "device_id": profile["device_id"],
        "income": profile["income"],
        "fixed_expenses": profile.get("fixed_expenses", 0),
        "current_balance": profile.get("current_balance", 0)
    }

@api_router.put("/device/{device_id}/balance")
async def update_balance(device_id: str, input_data: BalanceInput):
    result = await db.profiles.update_one(
        {"device_id": device_id},
        {"$set": {"current_balance": input_data.current_balance, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    return {"success": True, "current_balance": input_data.current_balance}

@api_router.post("/device/{device_id}/expense")
async def add_expense(device_id: str, input_data: ExpenseInput):
    if input_data.amount <= 0:
        raise HTTPException(status_code=400, detail="Valor deve ser positivo")

    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")

    expense = {
        "id": str(uuid.uuid4()),
        "device_id": device_id,
        "amount": input_data.amount,
        "date": today_str,
        "created_at": now.isoformat()
    }
    await db.expenses.insert_one(expense)

    # Deduct from balance
    await db.profiles.update_one(
        {"device_id": device_id},
        {"$inc": {"current_balance": -input_data.amount}}
    )

    # Log activity for streak
    await db.activities.update_one(
        {"device_id": device_id, "date": today_str},
        {"$set": {"device_id": device_id, "date": today_str, "type": "expense"}},
        upsert=True
    )

    return {"success": True, "amount": input_data.amount}

@api_router.post("/device/{device_id}/no-spend")
async def log_no_spend(device_id: str):
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    await db.activities.update_one(
        {"device_id": device_id, "date": today_str},
        {"$set": {"device_id": device_id, "date": today_str, "type": "no_spend"}},
        upsert=True
    )
    return {"success": True, "date": today_str}

# --- Fixed Expense Items ---

@api_router.get("/device/{device_id}/fixed-expenses")
async def get_fixed_expenses(device_id: str):
    items = await db.fixed_expense_items.find(
        {"device_id": device_id}, {"_id": 0}
    ).to_list(1000)
    total = sum(i["amount"] for i in items)
    paid_total = sum(i["amount"] for i in items if i.get("is_paid"))
    profile = await db.profiles.find_one({"device_id": device_id}, {"_id": 0})
    income = profile["income"] if profile else 0
    pct = round((total / income) * 100, 1) if income > 0 else 0
    return {
        "items": items,
        "total": round(total, 2),
        "paid_total": round(paid_total, 2),
        "pending_total": round(total - paid_total, 2),
        "income_percentage": pct,
        "health": "healthy" if pct < 50 else "high"
    }

@api_router.post("/device/{device_id}/fixed-expenses")
async def add_fixed_expense(device_id: str, input_data: FixedExpenseItemInput):
    item = {
        "id": str(uuid.uuid4()),
        "device_id": device_id,
        "name": input_data.name,
        "amount": input_data.amount,
        "is_paid": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.fixed_expense_items.insert_one(item)
    # Update profile fixed_expenses total
    await _sync_fixed_expenses_total(device_id)
    return {"success": True, "item": {k: v for k, v in item.items() if k != "_id"}}

@api_router.patch("/device/{device_id}/fixed-expenses/{item_id}")
async def toggle_fixed_expense(device_id: str, item_id: str, input_data: FixedExpenseToggleInput):
    result = await db.fixed_expense_items.update_one(
        {"device_id": device_id, "id": item_id},
        {"$set": {"is_paid": input_data.is_paid}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    return {"success": True}

@api_router.delete("/device/{device_id}/fixed-expenses/{item_id}")
async def delete_fixed_expense(device_id: str, item_id: str):
    result = await db.fixed_expense_items.delete_one({"device_id": device_id, "id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    await _sync_fixed_expenses_total(device_id)
    return {"success": True}

async def _sync_fixed_expenses_total(device_id: str):
    items = await db.fixed_expense_items.find({"device_id": device_id}, {"_id": 0}).to_list(1000)
    total = sum(i["amount"] for i in items)
    await db.profiles.update_one(
        {"device_id": device_id},
        {"$set": {"fixed_expenses": round(total, 2)}}
    )

# --- Summary ---

@api_router.get("/device/{device_id}/summary", response_model=SummaryResponse)
async def get_summary(device_id: str):
    profile = await db.profiles.find_one({"device_id": device_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    year, month = now.year, now.month
    month_start = f"{year}-{month:02d}-01"
    days_in_month = calendar.monthrange(year, month)[1]
    month_end = f"{year}-{month:02d}-{days_in_month}"

    expenses = await db.expenses.find(
        {"device_id": device_id, "date": {"$gte": month_start, "$lte": month_end}},
        {"_id": 0}
    ).to_list(10000)
    total_spent = sum(e["amount"] for e in expenses)
    today_spent = sum(e["amount"] for e in expenses if e["date"] == today_str)

    income = profile["income"]
    fixed_expenses = profile.get("fixed_expenses", 0)
    current_balance = profile.get("current_balance", income - fixed_expenses)
    free_money = income - fixed_expenses
    remaining = free_money - total_spent
    current_day = now.day
    days_left = max(days_in_month - current_day + 1, 1)
    daily_available = current_balance / days_left if days_left > 0 else 0

    # Streak
    streak = 0
    check_date = now.date()
    while True:
        date_str = check_date.strftime("%Y-%m-%d")
        activity = await db.activities.find_one({"device_id": device_id, "date": date_str}, {"_id": 0})
        if activity:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break

    # Health
    if current_balance <= 0:
        health_status = "critical"
    elif daily_available < 20:
        health_status = "warning"
    else:
        health_status = "healthy"

    # Feedback
    if current_balance <= 0:
        feedback = "Atenção! Seu saldo está zerado."
    elif daily_available < 10:
        feedback = "Cuidado! Seu orçamento diário está bem apertado."
    elif daily_available > free_money / days_in_month * 1.2:
        feedback = "Ótimo! Você está economizando bem este mês! 🎉"
    elif today_spent == 0:
        feedback = "Bom dia! Pronto para mais um dia consciente?"
    else:
        feedback = "Tudo certo! Continue controlando seus gastos."

    return SummaryResponse(
        income=income,
        fixed_expenses=fixed_expenses,
        current_balance=round(current_balance, 2),
        free_money=round(free_money, 2),
        total_spent=round(total_spent, 2),
        remaining=round(remaining, 2),
        days_left=days_left,
        daily_available=round(daily_available, 2),
        streak=streak,
        today_spent=round(today_spent, 2),
        feedback=feedback,
        health_status=health_status
    )

# --- Timeline ---

@api_router.get("/device/{device_id}/timeline")
async def get_timeline(device_id: str):
    profile = await db.profiles.find_one({"device_id": device_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    now = datetime.now(timezone.utc)
    year, month = now.year, now.month
    days_in_month = calendar.monthrange(year, month)[1]
    current_balance = profile.get("current_balance", 0)

    # Get all expenses this month
    month_start = f"{year}-{month:02d}-01"
    month_end = f"{year}-{month:02d}-{days_in_month}"
    expenses = await db.expenses.find(
        {"device_id": device_id, "date": {"$gte": month_start, "$lte": month_end}},
        {"_id": 0}
    ).to_list(10000)

    # Group by day
    by_day = {}
    for e in expenses:
        by_day.setdefault(e["date"], []).append(e["amount"])

    timeline = []
    running_balance = current_balance
    today = now.day
    days_left = max(days_in_month - today + 1, 1)

    # Future: calculate daily allowance from current balance
    future_daily = current_balance / days_left if days_left > 0 else 0

    # Rebuild: sum up expenses from today forward to restore what balance was before
    future_expenses_total = 0
    for day_num in range(today, days_in_month + 1):
        date_str = f"{year}-{month:02d}-{day_num:02d}"
        day_total = sum(by_day.get(date_str, []))
        future_expenses_total += day_total

    # Past days: reconstruct balance going backwards from current
    past_balance = current_balance
    for day_num in range(today, 0, -1):
        date_str = f"{year}-{month:02d}-{day_num:02d}"
        day_total = sum(by_day.get(date_str, []))
        past_balance += day_total  # add back expenses to get starting balance

    # Now walk forward
    walk_balance = past_balance
    for day_num in range(1, days_in_month + 1):
        date_str = f"{year}-{month:02d}-{day_num:02d}"
        day_total = sum(by_day.get(date_str, []))
        is_today = day_num == today
        is_past = day_num < today
        is_future = day_num > today

        if is_past or is_today:
            walk_balance -= day_total
            timeline.append({
                "date": date_str,
                "day": day_num,
                "type": "today" if is_today else "past",
                "spent": round(day_total, 2),
                "balance_after": round(walk_balance, 2),
            })
        else:
            projected_balance = walk_balance - future_daily * (day_num - today)
            timeline.append({
                "date": date_str,
                "day": day_num,
                "type": "future",
                "predicted_allowance": round(future_daily, 2),
                "projected_balance": round(projected_balance, 2),
                "warning": projected_balance <= 0,
            })

    return {"timeline": timeline, "current_day": today}

# --- Streak Calendar ---

@api_router.get("/device/{device_id}/streak-calendar")
async def get_streak_calendar(device_id: str, year: Optional[int] = None, month: Optional[int] = None):
    now = datetime.now(timezone.utc)
    y = year or now.year
    m = month or now.month
    days_in_month = calendar.monthrange(y, m)[1]
    month_start = f"{y}-{m:02d}-01"
    month_end = f"{y}-{m:02d}-{days_in_month}"

    activities = await db.activities.find(
        {"device_id": device_id, "date": {"$gte": month_start, "$lte": month_end}},
        {"_id": 0}
    ).to_list(1000)

    active_dates = {a["date"]: a.get("type", "unknown") for a in activities}

    # Current streak
    streak = 0
    check_date = now.date()
    while True:
        date_str = check_date.strftime("%Y-%m-%d")
        activity = await db.activities.find_one({"device_id": device_id, "date": date_str}, {"_id": 0})
        if activity:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break

    # Best streak - check last 90 days
    best_streak = 0
    current_run = 0
    for i in range(90, -1, -1):
        d = now.date() - timedelta(days=i)
        date_str = d.strftime("%Y-%m-%d")
        act = await db.activities.find_one({"device_id": device_id, "date": date_str}, {"_id": 0})
        if act:
            current_run += 1
            best_streak = max(best_streak, current_run)
        else:
            current_run = 0

    return {
        "year": y,
        "month": m,
        "days_in_month": days_in_month,
        "active_dates": active_dates,
        "current_streak": streak,
        "best_streak": best_streak,
        "first_weekday": calendar.monthrange(y, m)[0]  # 0=Monday
    }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
