# 🎯 Parakh AI (परख AI)

> **AI-Powered Career Companion & Job Offer Safety Platform**  
> *Empowering Indian students, freshers, and job seekers with honest career guidance and protection against job scams.*

[![Node.js Version](https://img.shields.io/badge/Node.js-v22+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/React-19.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Gemini AI](https://img.shields.io/badge/Powered%20By-Google%20Gemini-8E75B2?logo=google-gemini&logoColor=white)](https://ai.google.dev/)
[![SQLite](https://img.shields.io/badge/Database-SQLite%20(node:sqlite)-003B57?logo=sqlite&logoColor=white)](https://nodejs.org/api/sqlite.html)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

---

## 📖 Overview

**Parakh** (*परख*) translates to *scrutiny, appraisal, or test*. 

In the Indian job market, college students and fresh graduates—particularly from Tier-2 and Tier-3 cities—frequently face deceptive job offers, fraudulent registration fees, high-pressure recruitment scams, and ambiguous career dilemmas. 

**Parakh AI** is a full-stack career platform designed to solve these exact challenges. It provides instant job scam detection, real in-hand salary estimations, side-by-side 3-year trajectory comparisons, job market skill trends, and a friendly AI mentor fluent in both **English** and **Hinglish**.

---

## ✨ Core Features

### 🛡️ 1. Offer Check (Scam & Fake Job Detector)
- **Scam Risk Score (0–100%)**: Clear visual scoring with instant risk assessment (`Likely safe`, `Be careful`, `Likely scam`).
- **Red Flag Analysis**: Pinpoints suspicious demands such as upfront registration fees, refundable security deposits, WhatsApp/Telegram-only interviews, personal Gmail/Yahoo contact addresses, unrealistically high salaries, and exploitative bonds.
- **In-Hand Salary Calculator**: Decodes confusing CTC figures and provides a realistic monthly in-hand estimate after standard Indian deductions (PF, professional tax).
- **One-Click Company Verification**: Generates direct search queries to verify employers across Google Reviews, AmbitionBox, Glassdoor, LinkedIn, and the Ministry of Corporate Affairs (MCA).
- **Public Job Link Fetcher**: Paste a job URL; Parakh safely extracts the page text with built-in SSRF protections and redirect safety guards.

### 💬 2. Bilingual Career Mentor Chat
- **Multilingual Support**: Switch seamlessly between **Hinglish** (Hindi in Latin script) and **Simple English**.
- **Multimodal File Analysis**: Upload offer letters, resumes, or brochures in PDF, PNG, JPG, or WebP (up to 10 MB). Uses file magic byte verification for safety.
- **Persistent Context**: SQLite-backed conversation threads categorized per user with full markdown support.

### ⚖️ 3. Path Compare (3-Year Career Trajectory)
- **Side-by-Side Comparison**: Compare any two career paths (e.g., *Job in Noida vs. Full-time MBA*, *Frontend Developer vs. Data Analyst*).
- **3-Year Earnings Projection**: Realistic annual compensation expectations in LPA (Lakhs Per Annum).
- **Stress & Suitability Analysis**: Visual stress ratings (1–10), skills acquired, pros & cons, and honest verdicts tailored to individual backgrounds.

### 🎯 4. Skill Radar
- **Market Demand Trends**: Evaluates tech and professional skills against current Indian hiring patterns (`Growing`, `Stable`, `Declining`).
- **Growth Pathways**: Recommends next steps and targeted resources with direct search links to YouTube tutorials, Coursera, and free courses.

### 📋 5. My Applications (Job Tracker)
- **Status Tracking**: Organize job leads across standard pipeline stages: `Applied`, `Interview`, `Offer`, `Rejected`.
- **User-Specific Records**: Secured per user account with inline status updates and deletion.

### 🔐 6. Secure Authentication & Isolation
- **Custom Auth**: Built-in credential management utilizing `crypto.scrypt` with cryptographic salts and constant-time equality checks (`crypto.timingSafeEqual`).
- **Session Tokens**: Bearer-token authentication for isolated user sessions and data security.

---

## 🛠️ Architecture & Tech Stack

```mermaid
graph TD
    User([User Browser]) <--> |HTTP / JSON / Multi-part| FE[React 19 + Vite Frontend]
    FE <--> |REST API / Bearer Token| BE[Node.js + Express 5 Backend]
    BE <--> |node:sqlite DatabaseSync| DB[(parakh.db SQLite)]
    BE <--> |@google/genai SDK| Gemini[Google Gemini 2.5/3 Flash API]
```

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, React-Markdown, CSS3 Responsive Grid & Flexbox |
| **Backend** | Node.js (v22+), Express 5, CORS, Dotenv |
| **AI Model** | Google Gemini API (`@google/genai`), default `gemini-3.6-flash` |
| **Database** | Native SQLite via Node.js `node:sqlite` (`DatabaseSync`) |
| **Security** | Node `crypto` (`scrypt`, `timingSafeEqual`), DNS host verification (SSRF prevention), file magic-byte inspection |

---

## 📁 Repository Structure

```text
parakh-ai/
├── README.md                 # Project documentation
├── backend/
│   ├── .env.example          # Template for backend environment variables
│   ├── package.json          # Backend dependencies and scripts
│   ├── parakh.db             # Local SQLite database (auto-generated)
│   └── server.js             # Express API server & Gemini integration
└── frontend/
    ├── package.json          # Frontend dependencies and Vite configuration
    ├── index.html            # Single page app entry point
    ├── vite.config.js        # Vite build setup
    ├── public/               # Static assets & icons
    └── src/
        ├── App.jsx           # Main container & chat interface
        ├── App.css           # Global layout & component styles
        ├── Applications.jsx  # Job applications tracker component
        ├── OfferCheck.jsx    # Fake job & scam analysis tool
        ├── PathCompare.jsx   # 3-Year career comparison module
        ├── SkillRadar.jsx    # Skill trends & market demand tool
        ├── Login.jsx         # Sign up & login modal
        ├── Login.css         # Auth modal styling
        └── Links.css         # Shared card & link badge styles
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v22.0.0 or higher (required for native `node:sqlite` support)
- **npm**: v10.0.0 or higher
- **Gemini API Key**: Obtain a free API key from [Google AI Studio](https://aistudio.google.com/)

---

### 1. Clone the Repository
```bash
git clone https://github.com/kingjitasurana4447ji4u-prog/Parakh-ai.git
cd Parakh-ai
```

---

### 2. Configure Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your `.env` configuration:
   ```bash
   cp .env.example .env
   ```
4. Open `.env` and set your credentials:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-3.6-flash
   ```
5. Start the backend server:
   ```bash
   node server.js
   ```
   *The backend will run on [http://localhost:5000](http://localhost:5000).*

---

### 3. Configure Frontend
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to the local URL (typically [http://localhost:5173](http://localhost:5173)).

---

## 🔒 Security Best Practices Implemented

- **Password Storage**: Passwords are never stored in plaintext. They are salted with cryptographically secure random bytes and derived via `scryptSync(64)`.
- **Timing Attack Resistance**: Password verification uses `crypto.timingSafeEqual` to thwart timing-based side-channel attacks.
- **SSRF Protection**: URL fetching (`/api/fetch-job-link`) resolves DNS records and explicitly denies internal/private IPs (RFC 1918, loopbacks, link-local, carrier-grade NAT).
- **File Validation**: Uploaded documents are verified against real binary file signatures (magic bytes) to prevent file-type spoofing, with a 10 MB strict limit.

---

## 🤝 Contributing

Contributions, feedback, and feature suggestions are welcome!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m "Add some AmazingFeature"`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **ISC License**. See `package.json` for details.
