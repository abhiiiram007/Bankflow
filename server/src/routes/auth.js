import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db.js';
import { config } from '../config.js';

const router = Router();
const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(10).max(72)
});
const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(72)
});

function tokenFor(user) {
  return jwt.sign({ email: user.email }, config.jwtSecret, {
    subject: user.id,
    expiresIn: '2h'
  });
}

router.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid registration details' });

    const { fullName, email, password } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userResult = await client.query(
        'INSERT INTO users(full_name, email, password_hash) VALUES($1, $2, $3) RETURNING id, full_name, email',
        [fullName, email.toLowerCase(), passwordHash]
      );
      const user = userResult.rows[0];
      const accountNumber = `BF${Date.now().toString().slice(-8)}${Math.floor(Math.random()*90+10)}`;
      const accountResult = await client.query(
        `INSERT INTO accounts(user_id, account_number, account_name, balance_paise)
         VALUES($1, $2, $3, 0) RETURNING id, account_number, account_name, balance_paise, currency`,
        [user.id, accountNumber, fullName]
      );
      await client.query('COMMIT');
      res.status(201).json({ token: tokenFor(user), user, account: accountResult.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') return res.status(409).json({ error: 'Email already registered' });
      throw error;
    } finally {
      client.release();
    }
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid email or password' });
    const result = await pool.query(
      'SELECT id, full_name, email, password_hash FROM users WHERE email = $1',
      [parsed.data.email.toLowerCase()]
    );
    const user = result.rows[0];
    const valid = user && await bcrypt.compare(parsed.data.password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });
    res.json({
      token: tokenFor(user),
      user: { id: user.id, full_name: user.full_name, email: user.email }
    });
  } catch (error) { next(error); }
});

export default router;
