import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ShieldCheck, Wallet, LogOut, RefreshCw, Landmark, CreditCard, Activity } from 'lucide-react';
import { api } from './api';

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
}).format(Number(value || 0));

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('bankflow_token') || '');
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [history, setHistory] = useState([]);
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: 'demo@bankflow.local', password: 'BankFlow123!', fullName: '' });
  const [transfer, setTransfer] = useState({ toAccountNumber: 'BF00000002', amount: '', description: '' });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadDashboard(authToken = token) {
    const [a, h] = await Promise.all([
      api('/accounts/me', { token: authToken }),
      api('/transfers/history', { token: authToken })
    ]);
    setAccount(a);
    setHistory(h);
  }

  useEffect(() => {
    if (!token) return;
    loadDashboard().catch(() => {
      localStorage.removeItem('bankflow_token');
      setToken('');
    });
  }, [token]);

  async function authenticate(event) {
    event.preventDefault();
    setBusy(true); setNotice('');
    try {
      const data = await api(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(mode === 'login'
          ? { email: form.email, password: form.password }
          : { fullName: form.fullName, email: form.email, password: form.password })
      });
      localStorage.setItem('bankflow_token', data.token);
      setUser(data.user);
      setToken(data.token);
      setNotice('Welcome to BankFlow.');
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function sendTransfer(event) {
    event.preventDefault();
    setBusy(true); setNotice('');
    try {
      const data = await api('/transfers', {
        method: 'POST',
        token,
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          toAccountNumber: transfer.toAccountNumber,
          amount: Number(transfer.amount),
          description: transfer.description
        })
      });
      setNotice(`${data.message} · ${money(data.amount)}`);
      setTransfer({ toAccountNumber: '', amount: '', description: '' });
      await loadDashboard();
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  function logout() {
    localStorage.removeItem('bankflow_token');
    setToken(''); setUser(null); setAccount(null); setHistory([]);
    setNotice('');
  }

  if (!token) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand"><span className="brand-mark"><Landmark size={21}/></span><span>bankflow</span></div>
          <p className="eyebrow">DIGITAL BANKING DEMO</p>
          <h1>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>
          <p className="muted">A secure, transaction-focused banking experience.</p>
          <form onSubmit={authenticate} className="stack">
            {mode === 'register' && <label>Full name<input required minLength="2" value={form.fullName} onChange={e => setForm({...form, fullName:e.target.value})} placeholder="Your name"/></label>}
            <label>Email address<input required type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})}/></label>
            <label>Password<input required type="password" minLength="10" value={form.password} onChange={e => setForm({...form,password:e.target.value})}/></label>
            <button className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          </form>
          <p className="switch">{mode === 'login' ? 'New to BankFlow?' : 'Already registered?'} <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create account' : 'Sign in'}</button></p>
          <div className="demo-note"><ShieldCheck size={16}/> Demo login is prefilled. Use fictional data only.</div>
          {notice && <p className="notice">{notice}</p>}
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Landmark size={21}/></span><span>bankflow</span></div>
        <div className="side-label">WORKSPACE</div>
        <div className="nav-item active"><Wallet size={18}/> Overview</div>
        <div className="nav-item"><ArrowLeftRight size={18}/> Transfers</div>
        <div className="nav-item"><Activity size={18}/> Activity</div>
        <div className="side-bottom">
          <div className="secure"><ShieldCheck size={17}/><span>Protected demo session</span></div>
          <button className="logout" onClick={logout}><LogOut size={17}/> Sign out</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><p className="eyebrow">PERSONAL BANKING</p><h2>Overview</h2></div>
          <div className="profile"><div className="avatar">{(account?.account_name || 'U').slice(0,1).toUpperCase()}</div><span>{account?.account_name || 'Your account'}</span></div>
        </header>

        <section className="welcome-row">
          <div><p className="muted">Good to see you</p><h1>{account?.account_name || 'Welcome'}</h1><p className="muted">Here’s your account at a glance.</p></div>
          <button className="refresh" onClick={() => loadDashboard()}><RefreshCw size={16}/> Refresh</button>
        </section>

        {notice && <div className="notice-banner">{notice}<button onClick={() => setNotice('')}>×</button></div>}

        <section className="stats-grid">
          <div className="balance-card">
            <div className="card-top"><span>AVAILABLE BALANCE</span><Wallet size={19}/></div>
            <div className="balance">{money(account?.balance)}</div>
            <div className="account-meta"><span>{account?.account_number}</span><span>INR · Active</span></div>
          </div>
          <div className="stat-card"><div className="stat-icon"><ArrowUpRight/></div><p>Total outgoing</p><h3>{money(history.filter(x=>x.type==='DEBIT').reduce((s,x)=>s+Number(x.amount),0))}</h3><small>Recent 50 entries</small></div>
          <div className="stat-card"><div className="stat-icon green"><ArrowDownLeft/></div><p>Total incoming</p><h3>{money(history.filter(x=>x.type==='CREDIT').reduce((s,x)=>s+Number(x.amount),0))}</h3><small>Recent 50 entries</small></div>
        </section>

        <section className="content-grid">
          <div className="panel transfer-panel">
            <div className="panel-heading"><div><p className="eyebrow">PAYMENTS</p><h3>Make a transfer</h3></div><div className="round-icon"><ArrowLeftRight/></div></div>
            <form onSubmit={sendTransfer} className="stack">
              <label>Recipient account number<input required value={transfer.toAccountNumber} onChange={e=>setTransfer({...transfer,toAccountNumber:e.target.value})} placeholder="BF00000002"/></label>
              <label>Amount (INR)<div className="amount-input"><span>₹</span><input required type="number" min="0.01" max="1000000" step="0.01" value={transfer.amount} onChange={e=>setTransfer({...transfer,amount:e.target.value})} placeholder="0.00"/></div></label>
              <label>Description (optional)<input maxLength="140" value={transfer.description} onChange={e=>setTransfer({...transfer,description:e.target.value})} placeholder="What is this transfer for?"/></label>
              <button className="primary" disabled={busy}>{busy ? 'Processing…' : 'Review and send'} <ArrowUpRight size={17}/></button>
            </form>
            <p className="form-foot"><ShieldCheck size={14}/> Transfers are simulated using an atomic database transaction.</p>
          </div>

          <div className="panel activity-panel">
            <div className="panel-heading"><div><p className="eyebrow">ACCOUNT ACTIVITY</p><h3>Recent transactions</h3></div><CreditCard size={21}/></div>
            {history.length === 0 ? <div className="empty">No transactions yet. Make a demo transfer to see activity.</div> :
              <div className="transactions">{history.map(item=><div className="transaction" key={item.id}>
                <div className={`tx-icon ${item.type.toLowerCase()}`}>{item.type==='DEBIT'?<ArrowUpRight size={17}/>:<ArrowDownLeft size={17}/>}</div>
                <div className="tx-info"><strong>{item.description || (item.type==='DEBIT'?'Transfer sent':'Transfer received')}</strong><small>{item.counterpartyAccount} · {new Date(item.createdAt).toLocaleString()}</small></div>
                <strong className={item.type==='DEBIT'?'debit':'credit'}>{item.type==='DEBIT'?'-':'+'}{money(item.amount)}</strong>
              </div>)}</div>}
          </div>
        </section>
        <footer>BankFlow · Portfolio demonstration · No real money is moved</footer>
      </main>
    </div>
  );
}
