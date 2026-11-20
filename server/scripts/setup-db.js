import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
try {
  const schema = await fs.readFile(path.resolve(here, '../../database/schema.sql'), 'utf8');
  await pool.query(schema);

  const email = 'demo@bankflow.local';
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (!existing.rowCount) {
    const hash = await bcrypt.hash('BankFlow123!', 12);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const user = await client.query(
        'INSERT INTO users(full_name, email, password_hash) VALUES($1,$2,$3) RETURNING id',
        ['Demo User', email, hash]
      );
      await client.query(
        `INSERT INTO accounts(user_id, account_number, account_name, balance_paise)
         VALUES($1, 'BF00000001', 'Demo User', 2500000)`,
        [user.rows[0].id]
      );
      await client.query(
        `INSERT INTO users(full_name, email, password_hash) VALUES($1,$2,$3)`,
        ['Recipient Demo', 'recipient@bankflow.local', hash]
      );
      const recipient = await client.query('SELECT id FROM users WHERE email = $1', ['recipient@bankflow.local']);
      await client.query(
        `INSERT INTO accounts(user_id, account_number, account_name, balance_paise)
         VALUES($1, 'BF00000002', 'Recipient Demo', 1000000)`,
        [recipient.rows[0].id]
      );
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }
  console.log('Database ready.');
  console.log('Demo login: demo@bankflow.local / BankFlow123!');
  console.log('Recipient account: BF00000002');
} catch (error) {
  console.error('Database setup failed:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
