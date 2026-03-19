"""
Backend API tests for Niveli app
Tests setup, profile, expense, summary, and no-spend endpoints
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

class TestHealthCheck:
    """Basic health check"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ API root accessible: {data}")


class TestDeviceSetup:
    """Device setup endpoint tests"""
    
    def test_setup_new_device(self):
        """Test creating a new device profile"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        payload = {
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 2500.0
        }
        
        response = requests.post(f"{BASE_URL}/api/device/setup", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["device_id"] == device_id
        assert data["income"] == 5000.0
        assert data["fixed_expenses"] == 2500.0
        print(f"✓ Device setup successful: {device_id}")
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/device/{device_id}/profile")
        assert get_response.status_code == 200
        
        get_data = get_response.json()
        assert get_data["exists"] is True
        assert get_data["income"] == 5000.0
        assert get_data["fixed_expenses"] == 2500.0
        print(f"✓ Device profile persisted correctly")
    
    def test_setup_update_existing_device(self):
        """Test updating an existing device profile"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Create initial profile
        payload1 = {
            "device_id": device_id,
            "income": 3000.0,
            "fixed_expenses": 1500.0
        }
        requests.post(f"{BASE_URL}/api/device/setup", json=payload1)
        
        # Update profile
        payload2 = {
            "device_id": device_id,
            "income": 4000.0,
            "fixed_expenses": 2000.0
        }
        response = requests.post(f"{BASE_URL}/api/device/setup", json=payload2)
        assert response.status_code == 200
        
        data = response.json()
        assert data["income"] == 4000.0
        assert data["fixed_expenses"] == 2000.0
        print(f"✓ Device profile updated successfully")


class TestDeviceProfile:
    """Device profile retrieval tests"""
    
    def test_get_existing_profile(self):
        """Test retrieving an existing profile"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Create profile first
        payload = {
            "device_id": device_id,
            "income": 6000.0,
            "fixed_expenses": 3000.0
        }
        requests.post(f"{BASE_URL}/api/device/setup", json=payload)
        
        # Get profile
        response = requests.get(f"{BASE_URL}/api/device/{device_id}/profile")
        assert response.status_code == 200
        
        data = response.json()
        assert data["exists"] is True
        assert data["device_id"] == device_id
        assert data["income"] == 6000.0
        assert data["fixed_expenses"] == 3000.0
        print(f"✓ Profile retrieved successfully")
    
    def test_get_non_existing_profile(self):
        """Test retrieving a non-existing profile"""
        device_id = f"TEST_nonexistent_{uuid.uuid4()}"
        
        response = requests.get(f"{BASE_URL}/api/device/{device_id}/profile")
        assert response.status_code == 200
        
        data = response.json()
        assert data["exists"] is False
        print(f"✓ Non-existing profile returns exists=False")


class TestExpenseTracking:
    """Expense tracking endpoint tests"""
    
    def test_add_expense_success(self):
        """Test adding a valid expense"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup device first
        setup_payload = {
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 2000.0
        }
        requests.post(f"{BASE_URL}/api/device/setup", json=setup_payload)
        
        # Add expense
        expense_payload = {"amount": 50.0}
        response = requests.post(
            f"{BASE_URL}/api/device/{device_id}/expense",
            json=expense_payload
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["amount"] == 50.0
        print(f"✓ Expense added successfully")
        
        # Verify expense is reflected in summary
        summary_response = requests.get(f"{BASE_URL}/api/device/{device_id}/summary")
        assert summary_response.status_code == 200
        
        summary = summary_response.json()
        assert summary["total_spent"] == 50.0
        assert summary["today_spent"] == 50.0
        print(f"✓ Expense reflected in summary")
    
    def test_add_multiple_expenses(self):
        """Test adding multiple expenses"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup device
        setup_payload = {
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 2000.0
        }
        requests.post(f"{BASE_URL}/api/device/setup", json=setup_payload)
        
        # Add multiple expenses
        expenses = [10.0, 20.0, 50.0]
        for amount in expenses:
            response = requests.post(
                f"{BASE_URL}/api/device/{device_id}/expense",
                json={"amount": amount}
            )
            assert response.status_code == 200
        
        # Verify total
        summary_response = requests.get(f"{BASE_URL}/api/device/{device_id}/summary")
        summary = summary_response.json()
        assert summary["total_spent"] == sum(expenses)
        print(f"✓ Multiple expenses tracked correctly: total={sum(expenses)}")
    
    def test_add_invalid_expense_zero(self):
        """Test adding zero or negative expense"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup device
        setup_payload = {
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 2000.0
        }
        requests.post(f"{BASE_URL}/api/device/setup", json=setup_payload)
        
        # Try adding zero expense
        response = requests.post(
            f"{BASE_URL}/api/device/{device_id}/expense",
            json={"amount": 0.0}
        )
        assert response.status_code == 400
        print(f"✓ Zero expense rejected with 400")
    
    def test_add_invalid_expense_negative(self):
        """Test adding negative expense"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup device
        setup_payload = {
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 2000.0
        }
        requests.post(f"{BASE_URL}/api/device/setup", json=setup_payload)
        
        # Try adding negative expense
        response = requests.post(
            f"{BASE_URL}/api/device/{device_id}/expense",
            json={"amount": -10.0}
        )
        assert response.status_code == 400
        print(f"✓ Negative expense rejected with 400")


class TestNoSpendTracking:
    """No-spend day tracking tests"""
    
    def test_log_no_spend_day(self):
        """Test logging a no-spend day"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup device
        setup_payload = {
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 2000.0
        }
        requests.post(f"{BASE_URL}/api/device/setup", json=setup_payload)
        
        # Log no-spend day
        response = requests.post(
            f"{BASE_URL}/api/device/{device_id}/no-spend",
            json={}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "date" in data
        print(f"✓ No-spend day logged successfully")
        
        # Verify streak is updated
        summary_response = requests.get(f"{BASE_URL}/api/device/{device_id}/summary")
        summary = summary_response.json()
        assert summary["streak"] >= 1
        print(f"✓ Streak updated: {summary['streak']} day(s)")


class TestSummaryCalculations:
    """Summary endpoint calculation tests"""
    
    def test_summary_basic_calculations(self):
        """Test basic summary calculations"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup device
        income = 6000.0
        fixed_expenses = 2000.0
        setup_payload = {
            "device_id": device_id,
            "income": income,
            "fixed_expenses": fixed_expenses
        }
        requests.post(f"{BASE_URL}/api/device/setup", json=setup_payload)
        
        # Get summary
        response = requests.get(f"{BASE_URL}/api/device/{device_id}/summary")
        assert response.status_code == 200
        
        data = response.json()
        assert data["income"] == income
        assert data["fixed_expenses"] == fixed_expenses
        assert data["free_money"] == income - fixed_expenses
        assert data["total_spent"] == 0.0
        assert data["remaining"] == income - fixed_expenses
        assert data["days_left"] > 0
        assert data["daily_available"] > 0
        assert data["streak"] >= 0
        assert data["today_spent"] == 0.0
        assert len(data["feedback"]) > 0
        print(f"✓ Summary calculations correct: free_money={data['free_money']}, daily_available={data['daily_available']}")
    
    def test_summary_with_expenses(self):
        """Test summary with expenses added"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup device
        income = 5000.0
        fixed_expenses = 2000.0
        setup_payload = {
            "device_id": device_id,
            "income": income,
            "fixed_expenses": fixed_expenses
        }
        requests.post(f"{BASE_URL}/api/device/setup", json=setup_payload)
        
        # Add expenses
        total_expenses = 500.0
        requests.post(
            f"{BASE_URL}/api/device/{device_id}/expense",
            json={"amount": total_expenses}
        )
        
        # Get summary
        response = requests.get(f"{BASE_URL}/api/device/{device_id}/summary")
        data = response.json()
        
        expected_free_money = income - fixed_expenses
        expected_remaining = expected_free_money - total_expenses
        
        assert data["total_spent"] == total_expenses
        assert data["remaining"] == expected_remaining
        assert data["free_money"] == expected_free_money
        print(f"✓ Summary with expenses: spent={data['total_spent']}, remaining={data['remaining']}")
    
    def test_summary_non_existing_device(self):
        """Test summary for non-existing device"""
        device_id = f"TEST_nonexistent_{uuid.uuid4()}"
        
        response = requests.get(f"{BASE_URL}/api/device/{device_id}/summary")
        assert response.status_code == 404
        print(f"✓ Non-existing device returns 404")
    
    def test_summary_feedback_messages(self):
        """Test that feedback messages are generated"""
        device_id = f"TEST_device_{uuid.uuid4()}"
        
        # Setup device
        setup_payload = {
            "device_id": device_id,
            "income": 5000.0,
            "fixed_expenses": 2000.0
        }
        requests.post(f"{BASE_URL}/api/device/setup", json=setup_payload)
        
        # Get summary
        response = requests.get(f"{BASE_URL}/api/device/{device_id}/summary")
        data = response.json()
        
        assert "feedback" in data
        assert isinstance(data["feedback"], str)
        assert len(data["feedback"]) > 0
        print(f"✓ Feedback message generated: '{data['feedback']}'")


# Pytest fixture for shared session
@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
