import os
import sqlite3


def main() -> None:
    db_path = os.getenv("DB_PATH", "deepfake_local.db")
    abs_path = os.path.abspath(db_path)
    print(f"DB_PATH={abs_path}")

    con = sqlite3.connect(abs_path)
    try:
        cur = con.cursor()
        tables = cur.execute("select name from sqlite_master where type='table'").fetchall()
        print("tables=", tables)
        emails = cur.execute("select email from users order by id").fetchall()
        print("emails=", [e[0] for e in emails])
    finally:
        con.close()


if __name__ == "__main__":
    main()
