# 🛡️ Azure Bicep Visualiser

**Azure Bicep Visualiser** is a specialized DevOps and Cybersecurity tool designed to bridge the gap between Infrastructure-as-Code (IaC) and Governance. It allows developers to visualize their Azure Bicep deployments in real-time and automatically evaluates them against organizational Azure Policies before a single resource is ever deployed.

---

##  Key Features

* **Live Bicep-to-Graph Rendering**: Instantly converts Bicep code into an interactive, node-based infrastructure map using `@xyflow/react`.
* **Real-Time Policy Evaluation**: Integrates with a custom Python-based evaluation engine to flag security violations (e.g., public storage access, missing encryption).
* **Azure Integration**: Dynamically imports active Policy Definitions directly from your Azure Subscriptions using secure OAuth2/MSAL authentication.
* **Containerized Architecture**: Fully Dockerized environment for consistent development and deployment across Windows, Linux, and macOS.
* **Developer-First UX**: Features a built-in code editor, interactive resource cards with location metadata, and clear error bubbling for Bicep syntax.

---

## 🛠️ Technical Stack

### **Frontend**
* **React (Vite)**: High-performance UI rendering.
* **React Flow (@xyflow/react)**: Powering the interactive infrastructure graph.
* **Lucide React**: Consistent, modern iconography for Azure resources.
* **Tailwind CSS**: Sleek, dark-themed industrial design.

### **Backend**
* **FastAPI**: Asynchronous Python web framework for high-speed API processing.
* **Bicep CLI**: Native compilation of `.bicep` files into ARM JSON metadata.
* **Httpx**: For non-blocking, concurrent calls to the Azure Resource Manager (ARM) API.
* **Pydantic**: Strict data validation for incoming infrastructure code.

### **DevOps**
* **Docker & Docker Compose**: Multi-container orchestration.
* **Azure CLI**: Underlying bridge for local bicep compilation (Windows Dev).

---

## 📂 Project Structure

```text
.
├── backend/
│   ├── main.py              # FastAPI Routes & App Logic
│   ├── parsingEngine.py     # Bicep-to-ARM & Graph Logic
│   ├── evaluator.py         # Policy Rule Logic
│   ├── Dockerfile           # Python 3.13-slim + Bicep CLI
│   └── requirements.txt     # Python Dependencies
├── frontend/
│   ├── src/
│   │   ├── components/      # AzureNode, Sidebar, Editor
│   │   └── App.jsx          # Main Logic
│   ├── Dockerfile           # Node 20-alpine
│   └── package.json         # JS Dependencies
├── docker-compose.yml       # Full-Stack Orchestration
└── .env                     # (Ignored) Azure Credentials
```
## ⚙️ Setup & Installation

### **Prerequisites**
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed.
* An active Azure Subscription (for policy importing).

---

### **1. Configure Environment**
Create a `.env` file in the **root** directory (or separate ones in `/backend` and `/frontend`):

```bash
# Backend .env
AZURE_CLIENT_ID=your_client_id
AZURE_TENANT_ID=your_tenant_id
CORS_ALLOWED_ORIGINS="http://localhost:5173"

# Frontend .env
VITE_API_URL="http://localhost:8000"
```

### **2. Launch with Docker**
Simply run the following command from the root directory:

```bash
docker-compose up --build
```

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.

---