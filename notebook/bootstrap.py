import csv
import sqlite3
from pathlib import Path

data_dir = Path("/data")
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
