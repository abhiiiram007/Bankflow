import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { rupeesToPaise, paiseToRupees } from '../utils/money.js';

const router = Router();
router.use(requireAuth);

const schema = z.object({
  toAccountNumber: z.string().trim().regex(/^BF[A-Z0-9]{8,18}$/),
  amount: z.number().positive().max(1000000),
  description: z.string().trim().max(140).optional().default('')
});

router.post('/', async (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid transfer details' });

  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
    return res.status(400).json({ error: 'A valid Idempotency-Key header is required' });
  }

  let amountPaise;
  try { amountPaise = rupeesToPaise(parsed.data.amount); }
  catch { return res.status(400).json({ error: 'Invalid amount' }); }

  const requestHash = crypto.createHash('sha256')
    .update(JSON.stringify({
      toAccountNumber: parsed.data.toAccountNumber,
      amountPaise: amountPaise.toString(),
      description: parsed.data.description
    })).digest('hex');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const senderResult = await client.query(
      'SELECT a.* FROM accounts a WHERE a.user_id = $1',
      [req.user.id]
    );
    if (!senderResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sender account not found' });
    }
    const sender = senderResult.rows[0];

    const previous = await client.query(
      'SELECT id, request_hash, amount_paise, created_at FROM transfers WHERE sender_account_id = $1 AND idempotency_key = $2',
      [sender.id, idempotencyKey]
    );
    if (previous.rowCount) {
      await client.query('ROLLBACK');
      if (previous.rows[0].request_hash !== requestHash) {
        return res.status(409).json({ error: 'Idempotency key already used for a different request' });
      }
      return res.json({
        message: 'Transfer already processed',
        transferId: previous.rows[0].id,
        amount: paiseToRupees(previous.rows[0].amount_paise),
        repeated: true
      });
    }

    const recipientResult = await client.query(
      'SELECT * FROM accounts WHERE account_number = $1',
      [parsed.data.toAccountNumber]
    );
    if (!recipientResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recipient account not found' });
    }
    const recipient = recipientResult.rows[0];

    if (sender.id === recipient.id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot transfer to your own account' });
    }

    // Lock both account rows in a deterministic order to reduce deadlock risk.
    const ids = [sender.id, recipient.id].sort();
    const locked = await client.query(
      'SELECT id, balance_paise, status FROM accounts WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE',
      [ids]
    );
    const lockedSender = locked.rows.find(row => row.id === sender.id);
    const lockedRecipient = locked.rows.find(row => row.id === recipient.id);

    if (lockedSender.status !== 'ACTIVE' || lockedRecipient.status !== 'ACTIVE') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'One of the accounts is not active' });
    }
    if (BigInt(lockedSender.balance_paise) < amountPaise) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    await client.query(
      'UPDATE accounts SET balance_paise = balance_paise - $1 WHERE id = $2',
      [amountPaise.toString(), sender.id]
    );
    await client.query(
      'UPDATE accounts SET balance_paise = balance_paise + $1 WHERE id = $2',
      [amountPaise.toString(), recipient.id]
    );

    const transferResult = await client.query(
      `INSERT INTO transfers(sender_account_id, recipient_account_id, amount_paise, description, idempotency_key, request_hash)
       VALUES($1, $2, $3, $4, $5, $6)
       RETURNING id, amount_paise, description, created_at`,
      [sender.id, recipient.id, amountPaise.toString(), parsed.data.description, idempotencyKey, requestHash]
    );
    const transfer = transferResult.rows[0];

    await client.query(
      `INSERT INTO ledger_entries(transfer_id, account_id, entry_type, amount_paise)
       VALUES ($1, $2, 'DEBIT', $3), ($1, $4, 'CREDIT', $3)`,
      [transfer.id, sender.id, amountPaise.toString(), recipient.id]
    );

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Transfer successful',
      transferId: transfer.id,
      amount: paiseToRupees(transfer.amount_paise),
      description: transfer.description,
      createdAt: transfer.created_at,
      repeated: false
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') return res.status(409).json({ error: 'Duplicate transfer request' });
    next(error);
  } finally {
    client.release();
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const accountResult = await pool.query('SELECT id FROM accounts WHERE user_id = $1', [req.user.id]);
    if (!accountResult.rowCount) return res.status(404).json({ error: 'Account not found' });
    const accountId = accountResult.rows[0].id;
    const result = await pool.query(
      `SELECT t.id, t.amount_paise, t.description, t.created_at,
              le.entry_type,
              CASE WHEN le.entry_type = 'DEBIT' THEN recipient.account_number ELSE sender.account_number END AS counterparty_account
       FROM ledger_entries le
       JOIN transfers t ON t.id = le.transfer_id
       JOIN accounts sender ON sender.id = t.sender_account_id
       JOIN accounts recipient ON recipient.id = t.recipient_account_id
       WHERE le.account_id = $1
       ORDER BY t.created_at DESC
       LIMIT 50`,
      [accountId]
    );
    res.json(result.rows.map(row => ({
      id: row.id,
      type: row.entry_type,
      amount: paiseToRupees(row.amount_paise),
      description: row.description,
      counterpartyAccount: row.counterparty_account,
      createdAt: row.created_at
    })));
  } catch (error) { next(error); }
});

export default router;
