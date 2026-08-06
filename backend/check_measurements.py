import sqlite3
conn = sqlite3.connect('hms.db')
cur = conn.cursor()
print('tables:', [row[0] for row in cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()])
try:
    print('measurements count:', cur.execute('SELECT COUNT(*) FROM measurements').fetchone()[0])
    print('distinct years:', [row[0] for row in cur.execute('SELECT DISTINCT strftime("%Y", measurement_date) FROM measurements ORDER BY 1').fetchall()])
    print('sample dates:', [row[0] for row in cur.execute('SELECT measurement_date FROM measurements ORDER BY measurement_date DESC LIMIT 10').fetchall()])
except Exception as e:
    print('error querying measurements:', e)
conn.close()
