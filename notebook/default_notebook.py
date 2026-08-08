import marimo

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
    mo.md("# Pacuare Reserve turtle data\n\nYour own copy of `pacuare_raw`, ready to explore.")
    return


@app.cell
def _(pd, sqlite3):
    conn = sqlite3.connect("/data/pacuare.db")
    pacuare_raw = pd.read_sql_query("select * from pacuare_raw", conn)
    pacuare_raw
    return conn, pacuare_raw


if __name__ == "__main__":
    app.run()
