// Generates the files written into a freshly created sprite: a script that
// loads the exported `pacuare_raw` CSV into a local SQLite database, and a
// starter marimo notebook that opens it.

export function buildBootstrapScript(): string {
  return `import csv
import sqlite3
from pathlib import Path

data_dir = Path("/app/data")
data_dir.mkdir(parents=True, exist_ok=True)

db_path = data_dir / "pacuare.db"
csv_path = data_dir / "pacuare_raw.csv"

with open(csv_path, newline="", encoding="utf-8") as f:
    reader = csv.reader(f)
    header = next(reader)
    rows = list(reader)

con = sqlite3.connect(db_path)
cur = con.cursor()
cur.execute("drop table if exists pacuare_raw")
columns_sql = ", ".join(f'"{name}" text' for name in header)
cur.execute(f"create table pacuare_raw ({columns_sql})")
placeholders = ", ".join("?" for _ in header)
cur.executemany(f"insert into pacuare_raw values ({placeholders})", rows)
con.commit()
con.close()

print(f"Loaded {len(rows)} rows into {db_path}")
`
}

export function buildNotebook(): string {
  return `import marimo

__generated_with = "0.9.0"
app = marimo.App(width="medium")


@app.cell
def _():
    import sqlite3

    import marimo as mo
    import pandas as pd

    return mo, pd, sqlite3


@app.cell
def _(mo):
    mo.md("# Pacuare Reserve turtle data\\n\\nYour own copy of \`pacuare_raw\`, ready to explore.")
    return


@app.cell
def _(pd, sqlite3):
    conn = sqlite3.connect("/app/data/pacuare.db")
    pacuare_raw = pd.read_sql_query("select * from pacuare_raw", conn)
    pacuare_raw
    return conn, pacuare_raw


if __name__ == "__main__":
    app.run()
`
}
