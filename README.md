# SmartDB – Smart Database Normalization and Migration System

SmartDB is an end-to-end DBMS engineering application that accepts flat/unnormalized datasets (CSV or Excel), analyzes data types, cardinality, and functional dependencies, systematically decomposes the relations into **1NF, 2NF, and 3NF**, and physically migrates the normalized tables directly into **MySQL 8**.

---

## 🌟 Key Features

- **Multi-Format Ingestion**: Upload `.csv`, `.xlsx`, and `.xls` files with full preservation of original datasets.
- **Statistical Profiling**: Automatic inference of MySQL data types (`INT`, `DECIMAL`, `VARCHAR`, `DATETIME`), null percentages, cardinality ratios, and non-atomic values.
- **Dependency Inference**: Pairwise and composite functional dependency ($X \to Y$) detection with confidence scores.
- **Automated Normalization Engine**:
  - **1NF**: Atomic scalar checking and primary key enforcement.
  - **2NF**: Removal of partial dependencies on composite candidate keys.
  - **3NF**: Removal of transitive dependencies by extracting lookup relations.
- **Interactive Schema Designer**: Refine table names, column data types, and primary/foreign keys before physical database creation.
- **Live MySQL 8 Execution**:
  - Dynamically creates database schemas (`smartdb_dataset_<id>`).
  - Implements **topological sorting** on foreign key graphs to guarantee error-free DDL creation.
  - Deduplicates parent lookup entities and batch-inserts records with parameterization.
- **Multi-Format Deliverables**:
  - Multi-sheet Excel workbook (queried directly from live MySQL tables).
  - Complete `.sql` schema and data dump.
  - Interactive Entity-Relationship Diagram (ERD).
  - Normalization audit log.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18+ recommended)
- **MySQL 8** (running locally on port 3306 or configured via MySQL Workbench)

### 2. Configure Database Credentials
Edit `backend/.env` with your MySQL user and password:

```env
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_SYSTEM_NAME=smartdb_system
```

*(Note: On server startup, SmartDB will automatically create the `smartdb_system` database and catalog tables if they do not already exist).*

### 3. Run Backend Server
```bash
cd backend
npm install
npm run dev
```
The backend server runs on `http://localhost:5000`. You can test connection health at `http://localhost:5000/api/health`.

### 4. Run Frontend Client
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
The React frontend will be accessible at `http://localhost:5173`.

---

## 📂 Project Architecture

```text
SmartDB/
├── frontend/                 # React 18 + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/       # Navbar, Sidebar, DataTable, ERDViewer, UploadCard, StatCard
│   │   ├── pages/            # Dashboard, Upload, Analysis, Normalization, SchemaDesigner, Export
│   │   └── services/api.js   # Axios REST client
├── backend/                  # Node.js + Express
│   ├── config/database.js    # MySQL2 connection pools & dynamic database factory
│   ├── controllers/          # Upload, Analysis, Normalization, Migration, Export controllers
│   ├── services/             # Profiler, DependencyAnalyzer, NormalizationEngine, SchemaGenerator, MigrationService
│   ├── routes/               # Modular Express API endpoints
│   └── uploads/              # Preserved original uploaded files
├── database/
│   ├── schema.sql            # System catalog DDL (smartdb_system)
│   └── sample_data/          # Demo university enrollments & retail datasets
└── docs/                     # Project overview and database design documentation
```

---

## 🧪 Testing with Sample Data
SmartDB includes pre-configured unnormalized datasets in `database/sample_data/`:
1. `student_course_unnormalized.csv`: University enrollment dataset exhibiting partial and transitive dependencies.
2. `sales_orders_unnormalized.csv`: Retail customer order dataset.

You can upload these directly via the Upload page or click the built-in demo buttons on the Upload screen!

