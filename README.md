<div align="center">

# 🚀 LabLink_Inventory_System-main

![JAVASCRIPT](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black) ![TYPESCRIPT](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white) ![REACT](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) ![NODE.JS](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white) ![GitHub stars](https://img.shields.io/github/stars/karthikk20234119-cmd/Lab_Link?style=flat-square&logo=github)

<p align="center">
  A premium, high-performance project built using <strong>Node.js/JavaScript/TypeScript, HTML/CSS/JavaScript</strong> and structured with <strong>React</strong>.
</p>

<h4>
  <a href="https://github.com/karthikk20234119-cmd/Lab_Link.git">💻 View Codebase</a>
  <span> · </span>
  <a href="https://github.com/karthikk20234119-cmd/Lab_Link/issues">🐛 Report Bug</a>
  <span> · </span>
  <a href="https://github.com/karthikk20234119-cmd/Lab_Link/pulls">💡 Request Feature</a>
</h4>

</div>

---

## 📋 Table of Contents
- [📖 About the Project](#-about-the-project)
- [✨ Key Features](#-key-features)
- [🛠️ Tech Stack & Dependencies](#-tech-stack--dependencies)
- [⚙️ Getting Started & Installation](#️-getting-started--installation)
- [📂 Project Directory Structure](#-project-directory-structure)
- [🖼️ Visuals & Screenshots](#-visuals--screenshots)
- [🚀 Future Roadmap](#-future-roadmap)
- [🤝 Contributing Guidelines](#-contributing-guidelines)
- [📄 License](#-license)
- [👤 Author & Contact](#-author--contact)

## 📖 About the Project

### Custom Documentation Details

# LabLink: The Next-Generation Laboratory Ecosystem 🔬

**LabLink** (also known as Lab Inventory Pro) is a cloud-native, AI-augmented platform designed to unify inventory, borrowing, and maintenance into a single, high-performance ecosystem. Built for scalability, transparency, and compliance, it transforms the lab from a mere storage space into a data-driven operational hub.

![LabLink](https://img.shields.io/badge/Status-Active-success) ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white) ![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB) ![Vite](https://img.shields.io/badge/Vite-B73BFE?logo=vite&logoColor=FFD62E) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white) ![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)

---

## 🚀 Features

LabLink is built for different user personas (Admins/Staff, Students, Technicians) with access control securely handled down to the row level via Supabase RLS.

### 🛡️ Core Management Modules
- **Inventory & Chemicals Mastery**: Bulk import, automatic category filtering, Safety Leveling, and MSDS document linking (via Supabase Storage). Custom flows for chemical hazards.
- **Smart Borrowing System**: A Public Catalog for students to browse and request items, combined with purpose tracking and a state-machine logic for real-time status updates (Requested -> Approved -> Checked Out -> Returned).
- **Kiosk Mode**: A focused, tablet-optimized interface featuring built-in QR scanning, fast student record lookups, and rapid check-out/check-in flows.
- **Maintenance & Repairs**: Specialized Technician Dashboard with a dedicated repair queue, tracking of parts used, reasons for repair, and technician efficiency metrics.
- **Audit & Compliance (Trust Architecture)**: Immutable audit logs featuring SHA-256 data integrity hashes. Web Crypto API integration ensures that every action (Create/Update/Delete) is tamper-proof, with options for printable, certified Compliance PDFs.
- **AI Content Engine (Groq AI Integration)**: Automated cataloging! The built-in AI fetches high-res images, safety guidelines, and technical specs simply by entering the product name.

### 👥 Persona Journeys
- **Students**: Mobile-friendly browsing, dashboard for active borrow statuses, full history, and instant QR checkouts.
- **Technicians**: Focused repair queues, statistical tracking, part-usage logging.
- **Admins & Staff**: Deep analytics (borrowing heatmaps via Recharts), full infrastructure governance, role adjustments, and comprehensive data exporters (via Excel/PDF).

---

## 🛠️ Technology Stack

- **Frontend Core**: React 18, TypeScript, Vite
- **UI & Styling**: Tailwind CSS, shadcn/ui base components, Framer Motion (for premium micro-interactions), Lucide React (Icons)
- **Data Fetching & State**: TanStack React Query (`@tanstack/react-query`)
- **Backend & Database**: Supabase (PostgreSQL, Authentication, Realtime Pub/Sub, Edge Functions, Storage)
- **AI Integration**: Groq AI (Llama models) for metadata extraction and prompt engineering
- **Utilities**: `qrcode` and `jsqr` (QR Generation & Scanning), `recharts` (Analytics), `jspdf` & `xlsx` (Exporters)

---

## 📂 Project Structure

A quick overview of the essential directories and files that make up the LabLink application (`src/`):

```sh
lablink-web/
├── src/
│   ├── components/       # Reusable UI components (buttons, dialogs, forms, layout elements)
│   ├── hooks/            # Custom React hooks (e.g., auth hooks, fetching hooks)
│   ├── integrations/     # Supabase integrations and external API connectors
│   ├── lib/              # Utility functions, helpers, and configurations (e.g., shadcn utils)
│   ├── pages/            # Application pages/routes
│   │   ├── Auth.tsx             # Authentication (Login/Signup via Supabase)
│   │   ├── Dashboard.tsx        # Main Admin/Staff overview dashboard
│   │   ├── StudentDashboard.tsx # Dedicated view for student users
│   │   ├── Items.tsx / Chemicals.tsx / Categories.tsx # Inventory management
│   │   ├── BrowseItems.tsx / PublicCatalog.tsx        # Borrowing & discovery views
│   │   ├── QRManagement.tsx / QRScan.tsx / KioskMode.tsx # QR code operations
│   │   ├── Maintenance.tsx / Repairs.tsx              # Technician workflow views
│   │   ├── AuditLogs.tsx / Reports.tsx                # Security and Analytics
│   │   └── ...                  # Other specific feature pages
│   ├── services/         # Business logic and external service layers (e.g., Groq API logic)
│   ├── App.tsx           # Main application routing and providers
│   └── index.css         # Global Tailwind directives and base styles
├── supabase/             # Supabase configuration, migrations, and Edge Functions
│   └── functions/        # Serverless functions (e.g., delete-user hook)
├── tailwind.config.ts    # Tailwind CSS configuration and theme tokens
├── vite.config.ts        # Vite build and dev server configuration
└── package.json          # Node dependencies and project scripts
```

---

## 💻 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18+) and standard build tools installed.

### 1. Clone the repository

```bash
git clone <repository-url>
cd <repository-folder>
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the `.env.example` file to create your local `.env` configuration:

```bash
cp .env.example .env
```

You will need to configure your **Supabase URL**, **Supabase Anon Key**, and external API keys (like the **Groq AI Key**) in the `.env` file to communicate properly with your backend.

### 4. Run Development Server

Start the local Vite development server:

```bash
npm run dev
```

The application will be accessible at `http://localhost:8080` (or whichever port Vite allocates).

### 5. Build for Production

To create an optimized production build:

```bash
npm run build
```

---

## 🔒 Security & Data Integrity

LabLink employs enterprise-grade security mechanisms designed around **Row-Level Security (RLS)** in PostgreSQL.
- Data is strictly isolated; users can only interact with data their assigned Role permits.
- **Tamper-Proof Audit Logging**: State transitions or deletions of crucial assets create an immutable row that is hashed algorithmically.

---

## ⚖️ License & Acknowledgements

This ecosystem is proudly built leveraging powerful open-source technologies including React, Vite, Supabase, Tailwind, and shadcn/ui.

Designed with modern development practices in mind, this repository showcases a clean implementation optimized for scalability and readability.

## ✨ Key Features
- **Modular Architecture**: Separated concerns and clean layer boundaries for code reusability.
- **High-Performance Setup**: Optimized execution loops and configuration management.
- **Standards-Compliant**: Follows industry-wide formatting, design principles, and linting guidelines.
- **Ready for Deployment**: Structured to support quick dockerization, environment variables, or local launching.

## 🛠️ Tech Stack & Dependencies
*   **Language**: Node.js/JavaScript/TypeScript, HTML/CSS/JavaScript
*   **Framework/Platform**: React

### 📦 Key Dependencies
- `@hookform/resolvers`
- `@radix-ui/react-accordion`
- `@radix-ui/react-alert-dialog`
- `@radix-ui/react-aspect-ratio`
- `@radix-ui/react-avatar`
- `@radix-ui/react-checkbox`
- `@radix-ui/react-collapsible`
- `@radix-ui/react-context-menu`


## ⚙️ Getting Started & Installation

### 📋 Prerequisites
Ensure you have the runtime environment and managers installed for **Node.js/JavaScript/TypeScript, HTML/CSS/JavaScript**:
*   For JS/TS: **Node.js (v18+) & NPM**
*   For Python: **Python 3.10+ & pip**
*   For Flutter: **Flutter SDK**
*   For C#/.NET: **.NET SDK (v6.0+)**

### 💻 Installation Walkthrough

1. Clone the repository to your local workspace:
   ```bash
   git clone https://github.com/karthikk20234119-cmd/Lab_Link.git
   ```
2. Navigate into the project folder:
   ```bash
   cd LabLink_Inventory_System-main
   ```
3. Initialize the development environment and install dependencies:
   * **NodeJS**: `npm install`
   * **Python**: `pip install -r requirements.txt` (or activate your virtual environment first)
   * **Flutter**: `flutter pub get`
   * **.NET**: `dotnet restore`

4. Launch the application / script:
   * **NodeJS Dev Server**: `npm run dev`
   * **Python Core Script**: `python main.py` or `python app.py`
   * **FastAPI Server**: `uvicorn main:app --reload`
   * **Flutter Application**: `flutter run`
   * **.NET Core Solution**: `dotnet run`

## 📂 Project Directory Structure
```text
├── .env
├── .env.example
├── .github/
│   └── workflows/
├── .gitignore
├── .kilocode/
│   ├── .gitignore
│   ├── package-lock.json
│   └── package.json
├── DISCOVERY_PLAN.md
├── LabLink Inventory Evaluation.md
├── LabLink_Expert_Analysis_Report.md
├── PROPOSAL.md
├── README.md
├── STARTUP_PROPOSAL_V2.md
├── audit_report.md.resolved
└── ... and more items
```

## 🖼️ Visuals & Screenshots
> [!NOTE]
> *A visual walkthrough, screenshots, or design architecture diagram of the system will be showcased below.*

<div align="center">
  <img src="https://via.placeholder.com/800x400.png?text=Application+Screenshot+Placeholder" alt="App Showcase" width="800"/>
</div>

## 🚀 Future Roadmap
- [ ] Add comprehensive suite of unit and integration tests.
- [ ] Establish automated CI/CD pipelines via GitHub Actions.
- [ ] Optimize containerization structure with Docker multi-stage builds.
- [ ] Enhance documentation with API specifications (Swagger/OpenAPI if applicable).

## 🤝 Contributing Guidelines
Contributions are welcome! If you would like to submit bug fixes, feature requests, or improvements:
1. Fork the Project repository.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## 📄 License
Distributed under the **MIT License**. See the `LICENSE` file for more details.

## 👤 Author & Contact
*   **Developer**: [karthikk20234119-cmd](https://github.com/karthikk20234119-cmd)
*   **GitHub Link**: [https://github.com/karthikk20234119-cmd](https://github.com/karthikk20234119-cmd)
