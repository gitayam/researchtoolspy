#!/usr/bin/env python3
"""Validate every static SQL statement in this repo against the real D1 schema.

Why this exists
---------------
scripts/validate-schema.ts checks a hand-maintained list of tables and columns,
so it only catches what someone remembered to list. This script inverts that: it
mirrors the live schema into an in-memory SQLite database and asks SQLite itself
to PREPARE every `.prepare(...)` statement found in the source. Anything naming a
table or column that does not exist fails to prepare, exactly as it does in
production.

That sweep found twelve always-500 endpoints in one pass, including queries whose
very first column was wrong (`framework_sessions.framework_name`, which has been
`framework_type` for as long as the table has existed).

It also probes every table with `EXPLAIN INSERT ... DEFAULT VALUES` and every view
with a trivial SELECT. SQLite resolves trigger programs and view bodies at prepare
time, so a trigger left pointing at a dropped table makes its *host* table
unwritable. That is how `update_framework_comment_count`, orphaned when migration
113 dropped `framework_analytics`, was found to be breaking every INSERT into
`comments` -- the entire commenting feature -- with no code change to blame.

Usage
-----
  python3 scripts/check-sql-schema.py                 # pull schema from remote D1
  python3 scripts/check-sql-schema.py --schema x.json  # reuse a cached dump
  python3 scripts/check-sql-schema.py --dump x.json    # pull and cache the dump

Exit code is non-zero when anything fails, so it can gate a deploy.
"""

import argparse
import json
import os
import re
import sqlite3
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_ROOTS = ['functions', 'src', 'workers', 'api']
SKIP_DIRS = {'node_modules', 'dist', '.git', 'archive', 'backups'}
DB_NAME = 'researchtoolspy-prod'
SCHEMA_ERROR = re.compile(r'no such (column|table|function)|has no column|ambiguous column')
# A statement that is deliberately executed only after a runtime schema probe
# can legitimately name something this schema lacks. Mark it in a comment within
# the preceding few lines rather than weakening the check for everyone.
GUARD_MARKER = 'sql-schema-check: guarded'
GUARD_LOOKBEHIND = 12


def fetch_schema() -> list:
    """Pull sqlite_master from remote D1 via wrangler."""
    env = dict(os.environ)
    env.setdefault('CLOUDFLARE_ACCOUNT_ID', '04eac09ae835290383903273f68c79b0')
    out = subprocess.run(
        ['npx', 'wrangler', 'd1', 'execute', DB_NAME, '--remote', '--json',
         '--command', "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL"],
        cwd=REPO, env=env, capture_output=True, text=True,
    )
    if out.returncode != 0:
        sys.exit(f'wrangler failed:\n{out.stdout}\n{out.stderr}')
    return json.loads(out.stdout)[0]['results']


def build_mirror(rows: list) -> sqlite3.Connection:
    con = sqlite3.connect(':memory:')
    order = {'table': 0, 'view': 1, 'index': 2, 'trigger': 3}
    for row in sorted(rows, key=lambda r: order.get(r['type'], 9)):
        if row['name'].startswith('sqlite_'):
            continue
        try:
            con.execute(row['sql'])
        except Exception as exc:                      # noqa: BLE001
            print(f'  warn: could not mirror {row["type"]} {row["name"]}: {exc}')
    return con


def extract_statements(src: str):
    """Yield (offset, sql, is_dynamic) for each .prepare(<string literal>)."""
    for match in re.finditer(r'\.prepare\(\s*', src):
        i = match.end()
        if i >= len(src) or src[i] not in '`\'"':
            continue
        quote, i, buf, dynamic = src[i], i + 1, [], False
        while i < len(src):
            ch = src[i]
            if ch == '\\':
                buf.append(src[i:i + 2]); i += 2; continue
            if quote == '`' and ch == '$' and src[i + 1:i + 2] == '{':
                dynamic, depth, i = True, 1, i + 2
                while i < len(src) and depth:
                    depth += (src[i] == '{') - (src[i] == '}')
                    i += 1
                continue
            if ch == quote:
                break
            buf.append(ch); i += 1
        yield match.start(), ''.join(buf), dynamic


SQL_START = re.compile(r'^\s*(SELECT|INSERT|UPDATE|DELETE|REPLACE)\b', re.I)


def extract_sql_literals(src: str):
    r"""Yield (offset, sql) for every template literal that looks like a statement.

    extract_statements() only sees `.prepare(\`...\`)`. Plenty of handlers build the
    text first — `let query = \`SELECT ...\`` then `query += ...` then
    `.prepare(query)` — and those were skipped entirely. content-library.ts hid a
    `no such column: created_by` that way: the query targeted content_intelligence,
    which records its owner as user_id, and the endpoint had never returned a row.

    Fragments appended later (` ORDER BY x`) fail to prepare with a SYNTAX error,
    not a schema one, and the caller only reports schema errors — so they drop out
    without needing to be recognised.
    """
    for match in re.finditer(r'`', src):
        start = match.end()
        if not SQL_START.match(src[start:start + 40]):
            continue
        i, buf = start, []
        while i < len(src):
            ch = src[i]
            if ch == '\\':
                i += 2
                continue
            if ch == '$' and src[i + 1:i + 2] == '{':
                depth, i = 1, i + 2
                while i < len(src) and depth:
                    depth += (src[i] == '{') - (src[i] == '}')
                    i += 1
                buf.append(' 1 ')          # neutral filler for an interpolation
                continue
            if ch == '`':
                break
            buf.append(ch)
            i += 1
        yield match.start(), ''.join(buf)


def source_files():
    for root in SOURCE_ROOTS:
        base = os.path.join(REPO, root)
        if not os.path.isdir(base):
            continue
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for name in filenames:
                if name.endswith(('.ts', '.tsx')):
                    yield os.path.join(dirpath, name)


def check_statements(con: sqlite3.Connection) -> list:
    failures, checked, dynamic = [], 0, 0
    for path in sorted(source_files()):
        src = open(path, encoding='utf-8', errors='replace').read()
        for offset, sql, is_dynamic in extract_statements(src):
            statement = sql.strip()
            if not statement:
                continue
            if is_dynamic:
                dynamic += 1
                continue
            preceding = src.rfind('\n', 0, offset)
            window_start = offset
            for _ in range(GUARD_LOOKBEHIND):
                previous = src.rfind('\n', 0, window_start - 1)
                if previous == -1:
                    break
                window_start = previous + 1
            if GUARD_MARKER in src[window_start:preceding + 1]:
                continue

            checked += 1
            try:
                con.execute('EXPLAIN ' + statement, [None] * statement.count('?'))
            except Exception as exc:                  # noqa: BLE001
                message = str(exc)
                if not SCHEMA_ERROR.search(message):
                    continue                          # not a schema problem
                line = src.count('\n', 0, offset) + 1
                rel = os.path.relpath(path, REPO)
                failures.append((rel, line, message, ' '.join(statement.split())[:150]))
    # Second pass: SQL template literals that never reach .prepare() directly.
    literals = 0
    for path in sorted(source_files()):
        src = open(path, encoding='utf-8', errors='replace').read()
        rel = os.path.relpath(path, REPO)
        for offset, sql in extract_sql_literals(src):
            statement = sql.strip()
            if not statement or GUARD_MARKER in src[max(0, offset - 600):offset]:
                continue
            literals += 1
            try:
                con.execute('EXPLAIN ' + statement, [None] * statement.count('?'))
            except Exception as exc:                  # noqa: BLE001
                message = str(exc)
                if not SCHEMA_ERROR.search(message):
                    continue                          # fragment, or not a schema fault
                line = src.count('\n', 0, offset) + 1
                entry = (rel, line, message, ' '.join(statement.split())[:150])
                if entry not in failures:
                    failures.append(entry)

    print(f'statements: {checked} checked, {dynamic} skipped (runtime-interpolated)')
    print(f'sql literals: {literals} checked (built-then-prepared queries)')
    return failures


def check_triggers_and_views(con: sqlite3.Connection) -> list:
    """A dropped table can leave triggers/views behind that break other tables."""
    failures = []
    tables = [r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
    views = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='view'")]

    for table in tables:
        cols = [r[1] for r in con.execute(f'PRAGMA table_info("{table}")')]
        probes = {'INSERT': f'INSERT INTO "{table}" DEFAULT VALUES',
                  'DELETE': f'DELETE FROM "{table}" WHERE 0'}
        if cols:
            probes['UPDATE'] = f'UPDATE "{table}" SET "{cols[0]}" = "{cols[0]}" WHERE 0'
        for op, sql in probes.items():
            try:
                con.execute('EXPLAIN ' + sql)
            except Exception as exc:                  # noqa: BLE001
                if SCHEMA_ERROR.search(str(exc)):
                    failures.append(('trigger', f'{table} ({op})', str(exc), ''))

    for view in views:
        try:
            con.execute(f'EXPLAIN SELECT * FROM "{view}" LIMIT 0')
        except Exception as exc:                      # noqa: BLE001
            if SCHEMA_ERROR.search(str(exc)):
                failures.append(('view', view, str(exc), ''))

    print(f'schema objects: {len(tables)} tables, {len(views)} views probed')
    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--schema', help='reuse a cached sqlite_master dump')
    parser.add_argument('--dump', help='write the fetched dump here')
    args = parser.parse_args()

    if args.schema:
        rows = json.load(open(args.schema))
        rows = rows[0]['results'] if isinstance(rows, list) and rows and 'results' in rows[0] else rows
    else:
        rows = fetch_schema()
    if args.dump:
        json.dump([{'results': rows}], open(args.dump, 'w'), indent=1)

    con = build_mirror(rows)
    failures = check_triggers_and_views(con) + check_statements(con)

    if not failures:
        print('\nOK: every static statement prepares against the live schema.')
        return 0

    print(f'\n{len(failures)} FAILURE(S):\n')
    for where, line, message, statement in failures:
        print(f'  {where}:{line}\n      {message}')
        if statement:
            print(f'      {statement}')
    return 1


if __name__ == '__main__':
    sys.exit(main())
