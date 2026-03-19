"""
Backend API tests for Niveli app - Iteration 2 Features
Tests: current_balance, balance updates, fixed expenses CRUD, timeline, streak-calendar
"""
import pytest
import requests
import os
import uuid
from datetime import datetime
from pathlib import Path

# Load BACKEND_URL from frontend/.env
frontend_env_path = Path(__file__).parent.parent.parent / 'frontend' / '.env'
BASE_URL = None
if frontend_env_path.exists():
    with open(frontend_env_path) as f:
        for line in f:
            if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                break

if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL not found in frontend/.env")


class TestCurrentBalanceSetup:
    """Test setup endpoint with current_balance field"""
    
    def test_setup_with_current_balance(self):
        """Test setup with explicit current_balance"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        payload = {
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 2000.0,
            "current_balance": 2800.0
        }
        
        response = requests.post(f"{BASE_URL}/api/device/setup", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["device_id"] == device_id
        assert data["income"] == 5000.0
        assert data["fixed_expenses"] == 2000.0
        assert data["current_balance"] == 2800.0
        print(f"✓ Setup with current_balance successful: balance={data['current_balance']}")
        
        # Verify via profile
        profile_response = requests.get(f"{BASE_URL}/api/device/{device_id}/profile")
        profile_data = profile_response.json()
        assert profile_data["current_balance"] == 2800.0
        print(f"✓ Current balance persisted correctly")
    
    def test_setup_without_current_balance(self):
        """Test setup without current_balance (should default to income - fixed_expenses)"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        payload = {
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 2000.0
        }
        
        response = requests.post(f"{BASE_URL}/api/device/setup", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        expected_balance = 5000.0 - 2000.0
        assert data["current_balance"] == expected_balance
        print(f"✓ Setup without current_balance defaults correctly: {expected_balance}")


class TestBalanceUpdate:
    """Test PUT /api/device/{id}/balance endpoint"""
    
    def test_update_balance_success(self):
        """Test updating balance for existing device"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup device first
        setup_payload = {
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 2000.0,
            "current_balance": 2500.0
        }
        requests.post(f"{BASE_URL}/api/device/setup", json=setup_payload)
        
        # Update balance
        update_payload = {"current_balance": 3200.0}
        response = requests.put(f"{BASE_URL}/api/device/{device_id}/balance", json=update_payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["current_balance"] == 3200.0
        print(f"✓ Balance updated successfully: {data['current_balance']}")
        
        # Verify persistence
        profile_response = requests.get(f"{BASE_URL}/api/device/{device_id}/profile")
        profile_data = profile_response.json()
        assert profile_data["current_balance"] == 3200.0
        print(f"✓ Updated balance persisted correctly")
    
    def test_update_balance_non_existing_device(self):
        """Test updating balance for non-existing device"""
        device_id = f"TEST_nonexistent_{uuid.uuid4()}"
        update_payload = {"current_balance": 1000.0}
        
        response = requests.put(f"{BASE_URL}/api/device/{device_id}/balance", json=update_payload)
        assert response.status_code == 404
        print(f"✓ Non-existing device returns 404")


class TestSummaryWithCurrentBalance:
    """Test summary endpoint returns current_balance and health_status"""
    
    def test_summary_includes_current_balance(self):
        """Test that summary returns current_balance field"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup with current balance
        setup_payload = {
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 2000.0,
            "current_balance": 2800.0
        }
        requests.post(f"{BASE_URL}/api/device/setup", json=setup_payload)
        
        # Get summary
        response = requests.get(f"{BASE_URL}/api/device/{device_id}/summary")
        assert response.status_code == 200
        
        data = response.json()
        assert "current_balance" in data
        assert data["current_balance"] == 2800.0
        print(f"✓ Summary includes current_balance: {data['current_balance']}")
    
    def test_summary_includes_health_status(self):
        """Test that summary returns health_status field"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup device
        setup_payload = {
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 2000.0,
            "current_balance": 2500.0
        }
        requests.post(f"{BASE_URL}/api/device/setup", json=setup_payload)
        
        # Get summary
        response = requests.get(f"{BASE_URL}/api/device/{device_id}/summary")
        data = response.json()
        
        assert "health_status" in data
        assert data["health_status"] in ["healthy", "warning", "critical"]
        print(f"✓ Summary includes health_status: {data['health_status']}")
    
    def test_health_status_critical_when_balance_zero(self):
        """Test health_status is 'critical' when balance is zero or negative"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        setup_payload = {
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 2000.0,
            "current_balance": 0.0
        }
        requests.post(f"{BASE_URL}/api/device/setup", json=setup_payload)
        
        response = requests.get(f"{BASE_URL}/api/device/{device_id}/summary")
        data = response.json()
        
        assert data["health_status"] == "critical"
        print(f"✓ Health status is 'critical' when balance is zero")


class TestFixedExpensesCRUD:
    """Test fixed expenses CRUD operations"""
    
    def test_add_fixed_expense(self):
        """Test adding a new fixed expense item"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup device
        requests.post(f"{BASE_URL}/api/device/setup", json={
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 0.0
        })
        
        # Add fixed expense
        expense_payload = {
            "name": "Aluguel",
            "amount": 1500.0
        }
        response = requests.post(f"{BASE_URL}/api/device/{device_id}/fixed-expenses", json=expense_payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "item" in data
        assert data["item"]["name"] == "Aluguel"
        assert data["item"]["amount"] == 1500.0
        assert data["item"]["is_paid"] is False
        assert "id" in data["item"]
        print(f"✓ Fixed expense added: {data['item']['name']} - R$ {data['item']['amount']}")
        
        # Verify profile fixed_expenses total was synced
        profile_response = requests.get(f"{BASE_URL}/api/device/{device_id}/profile")
        profile_data = profile_response.json()
        assert profile_data["fixed_expenses"] == 1500.0
        print(f"✓ Profile fixed_expenses total synced: {profile_data['fixed_expenses']}")
    
    def test_get_fixed_expenses_list(self):
        """Test retrieving fixed expenses list"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup device
        requests.post(f"{BASE_URL}/api/device/setup", json={
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 0.0
        })
        
        # Add multiple fixed expenses
        items = [
            {"name": "Aluguel", "amount": 1500.0},
            {"name": "Internet", "amount": 100.0},
            {"name": "Luz", "amount": 150.0}
        ]
        for item in items:
            requests.post(f"{BASE_URL}/api/device/{device_id}/fixed-expenses", json=item)
        
        # Get list
        response = requests.get(f"{BASE_URL}/api/device/{device_id}/fixed-expenses")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert len(data["items"]) == 3
        assert data["total"] == 1750.0
        assert data["paid_total"] == 0.0
        assert data["pending_total"] == 1750.0
        assert data["income_percentage"] == 35.0  # 1750 / 5000 * 100
        assert data["health"] == "healthy"  # < 50%
        print(f"✓ Fixed expenses list retrieved: {len(data['items'])} items, total={data['total']}")
        print(f"✓ Health indicator: {data['health']} at {data['income_percentage']}% of income")
    
    def test_toggle_fixed_expense_paid_status(self):
        """Test toggling fixed expense is_paid status"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup and add expense
        requests.post(f"{BASE_URL}/api/device/setup", json={
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 0.0
        })
        
        add_response = requests.post(f"{BASE_URL}/api/device/{device_id}/fixed-expenses", json={
            "name": "Aluguel",
            "amount": 1500.0
        })
        item_id = add_response.json()["item"]["id"]
        
        # Toggle to paid
        toggle_response = requests.patch(
            f"{BASE_URL}/api/device/{device_id}/fixed-expenses/{item_id}",
            json={"is_paid": True}
        )
        assert toggle_response.status_code == 200
        assert toggle_response.json()["success"] is True
        print(f"✓ Fixed expense toggled to paid")
        
        # Verify in list
        list_response = requests.get(f"{BASE_URL}/api/device/{device_id}/fixed-expenses")
        list_data = list_response.json()
        assert list_data["paid_total"] == 1500.0
        assert list_data["pending_total"] == 0.0
        print(f"✓ Paid/pending totals updated correctly")
        
        # Toggle back to unpaid
        toggle_back = requests.patch(
            f"{BASE_URL}/api/device/{device_id}/fixed-expenses/{item_id}",
            json={"is_paid": False}
        )
        assert toggle_back.status_code == 200
        print(f"✓ Fixed expense toggled back to unpaid")
    
    def test_toggle_non_existing_expense(self):
        """Test toggling non-existing expense returns 404"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        requests.post(f"{BASE_URL}/api/device/setup", json={
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 0.0
        })
        
        fake_item_id = str(uuid.uuid4())
        response = requests.patch(
            f"{BASE_URL}/api/device/{device_id}/fixed-expenses/{fake_item_id}",
            json={"is_paid": True}
        )
        assert response.status_code == 404
        print(f"✓ Non-existing expense returns 404")
    
    def test_delete_fixed_expense(self):
        """Test deleting a fixed expense item"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup and add expenses
        requests.post(f"{BASE_URL}/api/device/setup", json={
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 0.0
        })
        
        add1 = requests.post(f"{BASE_URL}/api/device/{device_id}/fixed-expenses", json={
            "name": "Aluguel",
            "amount": 1500.0
        })
        item_id = add1.json()["item"]["id"]
        
        requests.post(f"{BASE_URL}/api/device/{device_id}/fixed-expenses", json={
            "name": "Internet",
            "amount": 100.0
        })
        
        # Delete first item
        delete_response = requests.delete(f"{BASE_URL}/api/device/{device_id}/fixed-expenses/{item_id}")
        assert delete_response.status_code == 200
        assert delete_response.json()["success"] is True
        print(f"✓ Fixed expense deleted")
        
        # Verify total updated
        list_response = requests.get(f"{BASE_URL}/api/device/{device_id}/fixed-expenses")
        list_data = list_response.json()
        assert len(list_data["items"]) == 1
        assert list_data["total"] == 100.0
        print(f"✓ Fixed expenses total synced after delete: {list_data['total']}")
        
        # Verify profile total synced
        profile_response = requests.get(f"{BASE_URL}/api/device/{device_id}/profile")
        profile_data = profile_response.json()
        assert profile_data["fixed_expenses"] == 100.0
        print(f"✓ Profile fixed_expenses synced after delete")
    
    def test_delete_non_existing_expense(self):
        """Test deleting non-existing expense returns 404"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        requests.post(f"{BASE_URL}/api/device/setup", json={
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 0.0
        })
        
        fake_item_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/device/{device_id}/fixed-expenses/{fake_item_id}")
        assert response.status_code == 404
        print(f"✓ Non-existing expense delete returns 404")


class TestExpenseDeductsBalance:
    """Test that adding expense deducts from current_balance"""
    
    def test_expense_deducts_from_current_balance(self):
        """Test adding expense reduces current_balance"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup with specific balance
        initial_balance = 3000.0
        requests.post(f"{BASE_URL}/api/device/setup", json={
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 2000.0,
            "current_balance": initial_balance
        })
        
        # Add expense
        expense_amount = 50.0
        requests.post(f"{BASE_URL}/api/device/{device_id}/expense", json={"amount": expense_amount})
        
        # Check balance via profile
        profile_response = requests.get(f"{BASE_URL}/api/device/{device_id}/profile")
        profile_data = profile_response.json()
        
        expected_balance = initial_balance - expense_amount
        assert profile_data["current_balance"] == expected_balance
        print(f"✓ Expense deducted from current_balance: {initial_balance} - {expense_amount} = {expected_balance}")
        
        # Also verify in summary
        summary_response = requests.get(f"{BASE_URL}/api/device/{device_id}/summary")
        summary_data = summary_response.json()
        assert summary_data["current_balance"] == expected_balance
        print(f"✓ Balance correctly reflected in summary")


class TestTimeline:
    """Test GET /api/device/{id}/timeline endpoint"""
    
    def test_timeline_returns_data(self):
        """Test timeline endpoint returns timeline data"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup device
        requests.post(f"{BASE_URL}/api/device/setup", json={
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 2000.0,
            "current_balance": 2800.0
        })
        
        # Get timeline
        response = requests.get(f"{BASE_URL}/api/device/{device_id}/timeline")
        assert response.status_code == 200
        
        data = response.json()
        assert "timeline" in data
        assert "current_day" in data
        assert isinstance(data["timeline"], list)
        assert len(data["timeline"]) > 0
        print(f"✓ Timeline returned {len(data['timeline'])} days for current month")
        print(f"✓ Current day: {data['current_day']}")
    
    def test_timeline_has_required_fields(self):
        """Test timeline items have required fields"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        requests.post(f"{BASE_URL}/api/device/setup", json={
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 2000.0,
            "current_balance": 2500.0
        })
        
        response = requests.get(f"{BASE_URL}/api/device/{device_id}/timeline")
        data = response.json()
        
        # Check a few timeline items
        for item in data["timeline"][:5]:
            assert "date" in item
            assert "day" in item
            assert "type" in item
            assert item["type"] in ["past", "today", "future"]
            print(f"✓ Day {item['day']} ({item['type']}): {item}")
    
    def test_timeline_non_existing_device(self):
        """Test timeline for non-existing device returns 404"""
        device_id = f"TEST_nonexistent_{uuid.uuid4()}"
        
        response = requests.get(f"{BASE_URL}/api/device/{device_id}/timeline")
        assert response.status_code == 404
        print(f"✓ Non-existing device returns 404")


class TestStreakCalendar:
    """Test GET /api/device/{id}/streak-calendar endpoint"""
    
    def test_streak_calendar_returns_data(self):
        """Test streak calendar endpoint returns calendar data"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup device
        requests.post(f"{BASE_URL}/api/device/setup", json={
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 2000.0
        })
        
        # Add activity
        requests.post(f"{BASE_URL}/api/device/{device_id}/no-spend")
        
        # Get streak calendar
        response = requests.get(f"{BASE_URL}/api/device/{device_id}/streak-calendar")
        assert response.status_code == 200
        
        data = response.json()
        assert "year" in data
        assert "month" in data
        assert "days_in_month" in data
        assert "active_dates" in data
        assert "current_streak" in data
        assert "best_streak" in data
        assert "first_weekday" in data
        print(f"✓ Streak calendar returned for {data['year']}-{data['month']}")
        print(f"✓ Current streak: {data['current_streak']}, Best streak: {data['best_streak']}")
        print(f"✓ Days in month: {data['days_in_month']}, Active dates: {len(data['active_dates'])}")
    
    def test_streak_calendar_with_activities(self):
        """Test streak calendar reflects logged activities"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup device
        requests.post(f"{BASE_URL}/api/device/setup", json={
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 2000.0
        })
        
        # Log multiple activities
        requests.post(f"{BASE_URL}/api/device/{device_id}/no-spend")
        requests.post(f"{BASE_URL}/api/device/{device_id}/expense", json={"amount": 10.0})
        
        # Get calendar
        response = requests.get(f"{BASE_URL}/api/device/{device_id}/streak-calendar")
        data = response.json()
        
        # Should have at least current_streak >= 1
        assert data["current_streak"] >= 1
        assert len(data["active_dates"]) >= 1
        print(f"✓ Streak calendar reflects activities: {len(data['active_dates'])} active dates")


# Pytest fixture for shared session
@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
