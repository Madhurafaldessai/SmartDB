# SmartDB – Smart Database Normalization and Migration System

## 1. Project Overview
**SmartDB** is a full-stack database engineering platform designed to accept unnormalized, flat data from CSV or Excel spreadsheets, analyze statistical cardinality and functional dependencies, systematically decompose the dataset into First (1NF), Second (2NF), and Third Normal Form (3NF), and physically generate a structured, relational database in **MySQL 8**.

---

## 2. Theoretical Normalization Foundations

### First Normal Form (1NF)
- **Principle**: An entity relation is in 1NF if and only if each attribute contains only atomic (indivisible) scalar values and there are no repeating groups.
- **SmartDB Implementation**:
  - The profiler scans string attributes against multi-valued delimiter patterns (`,`, `;`, `|`).
  - Ensures a candidate key is explicitly defined to identify individual tuples uniquely.

### Second Normal Form (2NF)
- **Principle**: A relation is in 2NF if it is in 1NF and no non-prime attribute is partially dependent on any candidate key (i.e., every non-prime attribute must depend on the whole candidate key, not a proper subset).
- **SmartDB Implementation**:
  - Identifies composite primary keys $(A, B)$.
  - Tests whether determinants $A \subset (A, B)$ satisfy $A \to C$.
  - Decomposes relation by extracting $T_A(A, C)$ with $A$ as Primary Key, leaving $(A, B, \dots)$ in the main relation.

### Third Normal Form (3NF)
- **Principle**: A relation is in 3NF if it is in 2NF and there are no transitive functional dependencies (i.e., for every non-trivial FD $X \to Y$, either $X$ is a superkey or $Y$ is a prime attribute).
- **SmartDB Implementation**:
  - Detects non-candidate key determinants $X$ that determine non-prime attributes $Y$ ($X \to Y$).
  - Extracts lookup relation $T_X(X, Y)$ with $X$ as Primary Key.
  - Retains $X$ as a Foreign Key in the parent relation, guaranteeing a lossless join decomposition.

---

## 3. Technology Stack

- **Frontend**: React.js 18 (Vite build system), Tailwind CSS, Lucide React, Axios.
- **Backend**: Node.js, Express.js (ESM modules), `csv-parse`, `exceljs`, `multer`.
- **Database**: MySQL 8 Server (`mysql2/promise` connection pooling).
- **Architecture**: Dual-database design (`smartdb_system` catalog + dynamic `smartdb_dataset_<id>` target databases).

