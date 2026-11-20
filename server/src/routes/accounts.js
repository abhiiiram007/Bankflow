import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { paiseToRupees } from '../utils/money.js';

const router = Router();
router.use(requireAuth);

router.get('/me', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, account_number, account_name, balance_paise, currency, status, created_at
       FROM accounts WHERE user_id = $1`,
      [req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Account not found' });
    const account = result.rows[0];
    res.json({
      ...account,
      balance: paiseToRupees(account.balance_paise),
      balance_paise: String(account.balance_paise)
    });
  } catch (error) { next(error); }
});

export default router;
