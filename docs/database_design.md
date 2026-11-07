# SmartDB Database Architecture & Relational Design

## 1. Dual-Database Paradigm

SmartDB employs two logical layers in MySQL:

```
+------------------------------------------------------------------------+
|                          MySQL 8 Server                                |
+------------------------------------+-----------------------------------+
|  1. Catalog (smartdb_system)       |  2. Target Datasets               |
|                                    |                                   |
|  - datasets                        |  smartdb_ds_001                   |
|  - dataset_columns                 |    - students (PK: student_id)    |
|  - functional_dependencies         |    - departments (PK: dept_id)    |
|  - normalization_runs              |    - enrollments (FK -> students) |
|  - generated_tables                |                                   |
|  - generated_columns               |  smartdb_ds_002                   |
|  - relationships                   |    - customers                    |
|  - migration_logs                  |    - orders                       |
+------------------------------------+-----------------------------------+
```

### `smartdb_system` Tables
1. **`datasets`**: Tracks original file metadata, row count, column count, storage path, status (`uploaded`, `analyzed`, `migrated`), and target database name.
2. **`dataset_columns`**: Column profile statistics (null count, uniqueness cardinality, candidate key indicators, detected MySQL data type).
3. **`functional_dependencies`**: Determinants, dependents, determinism ratio confidence scores, and user confirmation flags.
4. **`normalization_runs`**: Normalization execution history, target database name, target normal form (3NF).
5. **`generated_tables`**: Names and primary keys for decomposed relational tables.
6. **`generated_columns`**: Column data types, PK/FK constraints, and references.
7. **`relationships`**: Explicit foreign key bindings between parent and child tables.
8. **`migration_logs`**: Step-by-step audit logs capturing DDL and DML operations.

---

## 2. Foreign Key Ordering (Topological Dependency Sorting)

When creating tables with foreign keys, parent tables must be created **before** child tables. Otherwise, MySQL raises:
`Error 1215 (HY000): Cannot add foreign key constraint`

SmartDB's schema generator builds a directed acyclic graph (DAG) where an edge $P \to C$ signifies that child table $C$ holds a foreign key referencing parent table $P$. 
Using Kahn's algorithm:
1. Tables with in-degree 0 (independent parent/lookup tables) are queued first.
2. Each processed table reduces the in-degree of referencing tables.
3. Tables are created and populated in strict topological order.

---

## 3. Lossless Decomposition & Data Deduplication

When decomposing an unnormalized relation into parent lookup tables (e.g. `departments` from `[student_id, student_name, department_id, department_name, department_head]`):
1. **Deduplication**: Distinct records are selected by determinant (`department_id`).
2. **Lossless Join**: Because `department_id` is retained as a foreign key in `students`, a standard `INNER JOIN` or `NATURAL JOIN` reconstructs the exact original relation without spurious tuples.

