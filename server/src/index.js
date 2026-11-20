import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { pool } from './db.js';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import transferRoutes from './routes/transfers.js';
import { notFound, errorHandler } from './middleware/errors.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '20kb' }));

app.get('/api/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) { next(error); }
});

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transfers', transferRoutes);
app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`BankFlow API listening on http://localhost:${config.port}`);
});
