from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
import uuid
import bcrypt
from datetime import datetime, timezone, timedelta
import calendar

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ============================================================
# MODELS
# ============================================================

class RegisterInput(BaseModel):
    email: str
    password: str
    name: str

class LoginInput(BaseModel):
    email: str
    password: str

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

class FixedExpenseEditInput(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None

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

# ============================================================
# AUTH HELPERS
# ============================================================

def _generate_session_token():
    return f"sess_{uuid.uuid4().hex}"

def _generate_user_id():
    return f"user_{uuid.uuid4().hex[:12]}"

async def _get_user_from_token(request: Request):
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("session_token")
    if not token:
        return None
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        return None
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    return user

# ============================================================
# AUTH ROUTES
# ============================================================

@api_router.post("/auth/register")
async def register(input_data: RegisterInput):
    email = input_data.email.lower().strip()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    user_id = _generate_user_id()
    password_hash = bcrypt.hashpw(input_data.password.encode(), bcrypt.gensalt()).decode()
    now = datetime.now(timezone.utc).isoformat()
    await db.users.insert_one({
        "user_id": user_id,
        "email": email,
        "name": input_data.name.strip(),
        "password_hash": password_hash,
        "picture": "",
        "created_at": now,
    })
    session_token = _generate_session_token()
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "created_at": now,
    })
    return {"user_id": user_id, "session_token": session_token, "name": input_data.name.strip(), "email": email}

@api_router.post("/auth/login")
async def login(input_data: LoginInput):
    email = input_data.email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")
    if not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")
    if not bcrypt.checkpw(input_data.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")
    session_token = _generate_session_token()
    now = datetime.now(timezone.utc).isoformat()
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "created_at": now,
    })
    return {"user_id": user["user_id"], "session_token": session_token, "name": user["name"], "email": user["email"]}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await _get_user_from_token(request)
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    return {"user_id": user["user_id"], "email": user["email"], "name": user["name"], "picture": user.get("picture", "")}

@api_router.post("/auth/logout")
async def logout(request: Request):
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_many({"session_token": token})
    return {"success": True}

# ============================================================
# DEVICE / PROFILE ROUTES (existing - unchanged)
# ============================================================

@api_router.get("/")
async def root():
    return {"message": "Niveli API"}

@api_router.post("/device/setup", response_model=ProfileResponse)
async def setup_device(input_data: SetupInput):
    now = datetime.now(timezone.utc).isoformat()
    balance = input_data.current_balance if input_data.current_balance is not None else (input_data.income - input_data.fixed_expenses)
    await db.profiles.update_one(
        {"device_id": input_data.device_id},
        {"$set": {"device_id": input_data.device_id, "income": input_data.income, "fixed_expenses": input_data.fixed_expenses, "current_balance": balance, "updated_at": now},
         "$setOnInsert": {"created_at": now}},
        upsert=True
    )
    return ProfileResponse(device_id=input_data.device_id, income=input_data.income, fixed_expenses=input_data.fixed_expenses, current_balance=balance)

@api_router.get("/device/{device_id}/profile")
async def get_profile(device_id: str):
    profile = await db.profiles.find_one({"device_id": device_id}, {"_id": 0})
    if not profile:
        return {"exists": False}
    return {"exists": True, "device_id": profile["device_id"], "income": profile["income"], "fixed_expenses": profile.get("fixed_expenses", 0), "current_balance": profile.get("current_balance", 0)}

@api_router.put("/device/{device_id}/balance")
async def update_balance(device_id: str, input_data: BalanceInput):
    result = await db.profiles.update_one({"device_id": device_id}, {"$set": {"current_balance": input_data.current_balance, "updated_at": datetime.now(timezone.utc).isoformat()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    return {"success": True, "current_balance": input_data.current_balance}

@api_router.post("/device/{device_id}/expense")
async def add_expense(device_id: str, input_data: ExpenseInput):
    if input_data.amount <= 0:
        raise HTTPException(status_code=400, detail="Valor deve ser positivo")
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    await db.expenses.insert_one({"id": str(uuid.uuid4()), "device_id": device_id, "amount": input_data.amount, "date": today_str, "created_at": now.isoformat()})
    await db.profiles.update_one({"device_id": device_id}, {"$inc": {"current_balance": -input_data.amount}})
    await db.activities.update_one({"device_id": device_id, "date": today_str}, {"$set": {"device_id": device_id, "date": today_str, "type": "expense"}}, upsert=True)
    return {"success": True, "amount": input_data.amount}

@api_router.post("/device/{device_id}/no-spend")
async def log_no_spend(device_id: str):
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    await db.activities.update_one({"device_id": device_id, "date": today_str}, {"$set": {"device_id": device_id, "date": today_str, "type": "no_spend"}}, upsert=True)
    return {"success": True, "date": today_str}

# ============================================================
# FIXED EXPENSES - MONTHLY + RECURRING SYSTEM
# ============================================================

async def _ensure_month_initialized(device_id: str, month: int, year: int):
    """Auto-initialize a month's fixed expense instances from recurring templates."""
    existing = await db.monthly_expense_instances.find_one({"device_id": device_id, "month": month, "year": year}, {"_id": 0})
    if existing:
        return  # Already initialized
    templates = await db.recurring_expenses.find({"device_id": device_id, "is_active": True}, {"_id": 0}).to_list(1000)
    if not templates:
        # Check old fixed_expense_items for migration
        old_items = await db.fixed_expense_items.find({"device_id": device_id}, {"_id": 0}).to_list(1000)
        for item in old_items:
            tmpl_id = item.get("id", str(uuid.uuid4()))
            existing_tmpl = await db.recurring_expenses.find_one({"device_id": device_id, "id": tmpl_id}, {"_id": 0})
            if not existing_tmpl:
                await db.recurring_expenses.insert_one({"id": tmpl_id, "device_id": device_id, "name": item["name"], "amount": item["amount"], "is_active": True, "created_at": item.get("created_at", datetime.now(timezone.utc).isoformat())})
        templates = await db.recurring_expenses.find({"device_id": device_id, "is_active": True}, {"_id": 0}).to_list(1000)
    for t in templates:
        await db.monthly_expense_instances.update_one(
            {"device_id": device_id, "expense_id": t["id"], "month": month, "year": year},
            {"$setOnInsert": {"device_id": device_id, "expense_id": t["id"], "month": month, "year": year, "name": t["name"], "amount": t["amount"], "is_paid": False}},
            upsert=True
        )

async def _sync_fixed_expenses_total(device_id: str):
    now = datetime.now(timezone.utc)
    month, year = now.month, now.year
    instances = await db.monthly_expense_instances.find({"device_id": device_id, "month": month, "year": year}, {"_id": 0}).to_list(1000)
    total = sum(i["amount"] for i in instances)
    await db.profiles.update_one({"device_id": device_id}, {"$set": {"fixed_expenses": round(total, 2)}})

@api_router.get("/device/{device_id}/fixed-expenses")
async def get_fixed_expenses(device_id: str, month: Optional[int] = None, year: Optional[int] = None):
    now = datetime.now(timezone.utc)
    m = month or now.month
    y = year or now.year
    await _ensure_month_initialized(device_id, m, y)
    instances = await db.monthly_expense_instances.find({"device_id": device_id, "month": m, "year": y}, {"_id": 0}).to_list(1000)
    total = sum(i["amount"] for i in instances)
    paid_total = sum(i["amount"] for i in instances if i.get("is_paid"))
    profile = await db.profiles.find_one({"device_id": device_id}, {"_id": 0})
    income = profile["income"] if profile else 0
    pct = round((total / income) * 100, 1) if income > 0 else 0
    items = [{"id": i["expense_id"], "name": i["name"], "amount": i["amount"], "is_paid": i.get("is_paid", False)} for i in instances]
    return {"items": items, "total": round(total, 2), "paid_total": round(paid_total, 2), "pending_total": round(total - paid_total, 2), "income_percentage": pct, "health": "healthy" if pct < 50 else "high", "month": m, "year": y}

@api_router.post("/device/{device_id}/fixed-expenses")
async def add_fixed_expense(device_id: str, input_data: FixedExpenseItemInput):
    now = datetime.now(timezone.utc)
    expense_id = str(uuid.uuid4())
    await db.recurring_expenses.insert_one({"id": expense_id, "device_id": device_id, "name": input_data.name, "amount": input_data.amount, "is_active": True, "created_at": now.isoformat()})
    m, y = now.month, now.year
    await db.monthly_expense_instances.insert_one({"device_id": device_id, "expense_id": expense_id, "month": m, "year": y, "name": input_data.name, "amount": input_data.amount, "is_paid": False})
    await _sync_fixed_expenses_total(device_id)
    return {"success": True, "item": {"id": expense_id, "name": input_data.name, "amount": input_data.amount, "is_paid": False}}

@api_router.patch("/device/{device_id}/fixed-expenses/{item_id}")
async def toggle_fixed_expense(device_id: str, item_id: str, input_data: FixedExpenseToggleInput, month: Optional[int] = None, year: Optional[int] = None):
    now = datetime.now(timezone.utc)
    m = month or now.month
    y = year or now.year
    result = await db.monthly_expense_instances.update_one({"device_id": device_id, "expense_id": item_id, "month": m, "year": y}, {"$set": {"is_paid": input_data.is_paid}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    return {"success": True}

@api_router.put("/device/{device_id}/fixed-expenses/{item_id}")
async def edit_fixed_expense(device_id: str, item_id: str, input_data: FixedExpenseEditInput):
    now = datetime.now(timezone.utc)
    m, y = now.month, now.year
    update_fields = {}
    if input_data.name is not None:
        update_fields["name"] = input_data.name
    if input_data.amount is not None:
        update_fields["amount"] = input_data.amount
    if not update_fields:
        raise HTTPException(status_code=400, detail="Nada para atualizar")
    await db.recurring_expenses.update_one({"device_id": device_id, "id": item_id}, {"$set": update_fields})
    # Update current + future instances
    future_filter = {"device_id": device_id, "expense_id": item_id, "$or": [{"year": {"$gt": y}}, {"year": y, "month": {"$gte": m}}]}
    await db.monthly_expense_instances.update_many(future_filter, {"$set": update_fields})
    await _sync_fixed_expenses_total(device_id)
    return {"success": True}

@api_router.delete("/device/{device_id}/fixed-expenses/{item_id}")
async def delete_fixed_expense(device_id: str, item_id: str):
    now = datetime.now(timezone.utc)
    m, y = now.month, now.year
    await db.recurring_expenses.update_one({"device_id": device_id, "id": item_id}, {"$set": {"is_active": False}})
    # Delete current + future instances only (preserve past)
    await db.monthly_expense_instances.delete_many({"device_id": device_id, "expense_id": item_id, "$or": [{"year": {"$gt": y}}, {"year": y, "month": {"$gte": m}}]})
    await _sync_fixed_expenses_total(device_id)
    return {"success": True}

# ============================================================
# SUMMARY (unchanged logic)
# ============================================================

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
    expenses = await db.expenses.find({"device_id": device_id, "date": {"$gte": month_start, "$lte": month_end}}, {"_id": 0}).to_list(10000)
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
    streak = 0
    check_date = now.date()
    while True:
        activity = await db.activities.find_one({"device_id": device_id, "date": check_date.strftime("%Y-%m-%d")}, {"_id": 0})
        if activity:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break
    if current_balance <= 0:
        health_status = "critical"
    elif daily_available < 20:
        health_status = "warning"
    else:
        health_status = "healthy"
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
    return SummaryResponse(income=income, fixed_expenses=fixed_expenses, current_balance=round(current_balance, 2), free_money=round(free_money, 2), total_spent=round(total_spent, 2), remaining=round(remaining, 2), days_left=days_left, daily_available=round(daily_available, 2), streak=streak, today_spent=round(today_spent, 2), feedback=feedback, health_status=health_status)

# ============================================================
# TIMELINE (unchanged)
# ============================================================

@api_router.get("/device/{device_id}/timeline")
async def get_timeline(device_id: str):
    profile = await db.profiles.find_one({"device_id": device_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    now = datetime.now(timezone.utc)
    year, month = now.year, now.month
    days_in_month = calendar.monthrange(year, month)[1]
    current_balance = profile.get("current_balance", 0)
    month_start = f"{year}-{month:02d}-01"
    month_end = f"{year}-{month:02d}-{days_in_month}"
    expenses = await db.expenses.find({"device_id": device_id, "date": {"$gte": month_start, "$lte": month_end}}, {"_id": 0}).to_list(10000)
    by_day = {}
    for e in expenses:
        by_day.setdefault(e["date"], []).append(e["amount"])
    today = now.day
    days_left = max(days_in_month - today + 1, 1)
    future_daily = current_balance / days_left if days_left > 0 else 0
    past_balance = current_balance
    for day_num in range(today, 0, -1):
        date_str = f"{year}-{month:02d}-{day_num:02d}"
        past_balance += sum(by_day.get(date_str, []))
    walk_balance = past_balance
    timeline = []
    for day_num in range(1, days_in_month + 1):
        date_str = f"{year}-{month:02d}-{day_num:02d}"
        day_total = sum(by_day.get(date_str, []))
        is_today = day_num == today
        is_past = day_num < today
        if is_past or is_today:
            walk_balance -= day_total
            timeline.append({"date": date_str, "day": day_num, "type": "today" if is_today else "past", "spent": round(day_total, 2), "balance_after": round(walk_balance, 2)})
        else:
            projected = walk_balance - future_daily * (day_num - today)
            timeline.append({"date": date_str, "day": day_num, "type": "future", "predicted_allowance": round(future_daily, 2), "projected_balance": round(projected, 2), "warning": projected <= 0})
    return {"timeline": timeline, "current_day": today}

# ============================================================
# STREAK CALENDAR (unchanged)
# ============================================================

@api_router.get("/device/{device_id}/streak-calendar")
async def get_streak_calendar(device_id: str, year: Optional[int] = None, month: Optional[int] = None):
    now = datetime.now(timezone.utc)
    y = year or now.year
    m = month or now.month
    days_in_month = calendar.monthrange(y, m)[1]
    month_start = f"{y}-{m:02d}-01"
    month_end = f"{y}-{m:02d}-{days_in_month}"
    activities = await db.activities.find({"device_id": device_id, "date": {"$gte": month_start, "$lte": month_end}}, {"_id": 0}).to_list(1000)
    active_dates = {a["date"]: a.get("type", "unknown") for a in activities}
    streak = 0
    check_date = now.date()
    while True:
        act = await db.activities.find_one({"device_id": device_id, "date": check_date.strftime("%Y-%m-%d")}, {"_id": 0})
        if act:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break
    best_streak = 0
    current_run = 0
    for i in range(90, -1, -1):
        d = now.date() - timedelta(days=i)
        act = await db.activities.find_one({"device_id": device_id, "date": d.strftime("%Y-%m-%d")}, {"_id": 0})
        if act:
            current_run += 1
            best_streak = max(best_streak, current_run)
        else:
            current_run = 0
    return {"year": y, "month": m, "days_in_month": days_in_month, "active_dates": active_dates, "current_streak": streak, "best_streak": best_streak, "first_weekday": calendar.monthrange(y, m)[0]}

# ============================================================
# APP SETUP
# ============================================================

app.include_router(api_router)

app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
