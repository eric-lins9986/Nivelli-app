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

class ProfileResponse(BaseModel):
    device_id: str
    income: float
    fixed_expenses: float

class ExpenseInput(BaseModel):
    amount: float

class NoSpendInput(BaseModel):
    pass

class SummaryResponse(BaseModel):
    income: float
    fixed_expenses: float
    free_money: float
    total_spent: float
    remaining: float
    days_left: int
    daily_available: float
    streak: int
    today_spent: float
    feedback: str

# --- Routes ---

@api_router.get("/")
async def root():
    return {"message": "Niveli API"}

@api_router.post("/device/setup", response_model=ProfileResponse)
async def setup_device(input_data: SetupInput):
    now = datetime.now(timezone.utc).isoformat()
    await db.profiles.update_one(
        {"device_id": input_data.device_id},
        {"$set": {
            "device_id": input_data.device_id,
            "income": input_data.income,
            "fixed_expenses": input_data.fixed_expenses,
            "updated_at": now
        },
        "$setOnInsert": {"created_at": now}},
        upsert=True
    )
    return ProfileResponse(
        device_id=input_data.device_id,
        income=input_data.income,
        fixed_expenses=input_data.fixed_expenses
    )

@api_router.get("/device/{device_id}/profile")
async def get_profile(device_id: str):
    profile = await db.profiles.find_one(
        {"device_id": device_id},
        {"_id": 0}
    )
    if not profile:
        return {"exists": False}
    return {
        "exists": True,
        "device_id": profile["device_id"],
        "income": profile["income"],
        "fixed_expenses": profile["fixed_expenses"]
    }

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

@api_router.get("/device/{device_id}/summary", response_model=SummaryResponse)
async def get_summary(device_id: str):
    profile = await db.profiles.find_one(
        {"device_id": device_id},
        {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    year = now.year
    month = now.month
    month_start = f"{year}-{month:02d}-01"
    days_in_month = calendar.monthrange(year, month)[1]
    month_end = f"{year}-{month:02d}-{days_in_month}"

    # Calculate total spent this month
    expenses_cursor = db.expenses.find(
        {"device_id": device_id, "date": {"$gte": month_start, "$lte": month_end}},
        {"_id": 0}
    )
    expenses = await expenses_cursor.to_list(10000)
    total_spent = sum(e["amount"] for e in expenses)

    # Today's expenses
    today_expenses = [e for e in expenses if e["date"] == today_str]
    today_spent = sum(e["amount"] for e in today_expenses)

    # Core logic
    income = profile["income"]
    fixed_expenses = profile["fixed_expenses"]
    free_money = income - fixed_expenses
    remaining = free_money - total_spent
    current_day = now.day
    days_left = max(days_in_month - current_day + 1, 1)  # include today
    daily_available = remaining / days_left if days_left > 0 else 0

    # Calculate streak
    streak = 0
    check_date = now.date()
    while True:
        date_str = check_date.strftime("%Y-%m-%d")
        activity = await db.activities.find_one(
            {"device_id": device_id, "date": date_str},
            {"_id": 0}
        )
        if activity:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break

    # Feedback messages
    if remaining <= 0:
        feedback = "Atenção! Você já ultrapassou seu orçamento este mês."
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
        free_money=round(free_money, 2),
        total_spent=round(total_spent, 2),
        remaining=round(remaining, 2),
        days_left=days_left,
        daily_available=round(daily_available, 2),
        streak=streak,
        today_spent=round(today_spent, 2),
        feedback=feedback
    )

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
