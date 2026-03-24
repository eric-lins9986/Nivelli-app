# 📊 Nivelli — Smart Personal Finance App

Nivelli is a full-stack personal finance application designed to help users manage their money in a simple and practical way.

The core idea is to provide clear financial control and assist users in understanding their balance, expenses, and financial behavior — without requiring advanced financial knowledge.

## 📸 Preview

![App Demo](assets/APP%20PREVIEW.gif)

![Home](assets/FOTO%203%20NIVELLI%20APP.jpeg)
![Sign Up](assets/FOTO%202%20NIVELLI%20APP.jpeg)
![Settings](assets/FOTO%201%20NIVELLI%20APP.jpeg)

---

## 🧠 Problem it Solves

Many people struggle with managing their finances due to lack of financial education and overly complex tools.

Nivelli focuses on simplicity:
- Helping users track their balance and expenses
- Providing a clear view of financial status
- Making financial control accessible and easy to understand

---

## 🚀 Features

- Balance management and updates
- Expense tracking (including fixed expenses)
- Financial data processing and updates
- Summary and financial overview
- Backend API tests for validation and consistency
- Timeline and structured financial tracking logic

---

## 🧩 Architecture

The project follows a full-stack structure:


/backend → API, business logic, financial calculations
/frontend → Mobile interface (React Native + Expo)


### Backend
- Built with Python
- Main logic handled in `server.py`
- Handles:
  - Balance updates
  - Expense tracking
  - Financial summaries
- Includes API and integration tests for:
  - Balance consistency
  - Expense CRUD operations
  - Timeline and financial flow validation

### Frontend
- Built with React Native using Expo
- Written in TypeScript (`.tsx`)
- Responsible for:
  - User interface
  - User input (balance, expenses)
  - Navigation and interaction

---

## 🛠️ Tech Stack

**Backend**
- Python
- REST-like API structure
- Automated tests (integration & API tests)

**Frontend**
- React Native
- Expo
- TypeScript

**Other Tools**
- Node.js ecosystem
- Yarn
- Git & GitHub

---

## ⚙️ How it Works

The application is divided into two main layers:

1. The frontend allows users to input financial data such as balance and expenses.
2. The backend processes this data, applies financial logic, and returns structured results.

The system maintains financial consistency by:
- Tracking balance updates
- Managing expense records
- Validating calculations through automated tests

---

## ▶️ Running the Project

###Backend

```bash
cd backend
pip install -r requirements.txt
python server.py

Frontend

cd frontend
yarn install
npx expo start

Then scan the QR code using Expo Go on your mobile device.

🧪 Testing

The backend includes test files for validating core functionalities:

API behavior
Balance updates
Expense management
Financial summaries

Tests are located inside the /backend/tests directory.

📌 Project Status

This project is currently in development (MVP stage).

Core functionalities are implemented, and improvements are continuously being made.

This project was initially scaffolded with the assistance of AI tools and further developed through manual refinement.

I focused on understanding, adapting, and improving the generated code, ensuring correctness, structure, and scalability.

The developer focused on:

Understanding and adapting the generated code
Debugging and improving system behavior
Structuring the application and refining features

📈 Future Improvements

Enhanced financial insights and analytics
Improved UI/UX experience
Data persistence improvements
Authentication system
Deployment and scalability improvements



📬 Contact

Eric Gabriel Lins Nascimento
📍 São Paulo, Brazil
🔗 LinkedIn: https://linkedin.com/in/ericgabriellins
