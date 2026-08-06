import sqlite3
conn = sqlite3.connect('hms.db')
cur = conn.cursor()
print('TABLES:', [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()])
print('USER COUNT:', cur.execute('SELECT COUNT(*) FROM users').fetchone()[0])
print('USERS SAMPLE:')
for row in cur.execute('SELECT username, role, account_status, is_active, failed_login_attempts, account_locked_until FROM users LIMIT 50'):
    print(row)
print('---')
conn.close()
