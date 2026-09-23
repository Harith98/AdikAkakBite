"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  LogOut,
  ShoppingBag,
  TrendingUp,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase-browser";

type Task = { id: string; title: string; status: string; category: string | null };
type Order = { id: string; order_date: string; required_time: string | null; status: string; payment_status: string; total: number; customers: { name: string } | null };

const schedule = [["11:00–11:30", "Opening & Planning"], ["11:30–13:00", "Production"], ["13:00–14:00", "Content Creation"], ["14:00–14:30", "Break"], ["14:30–15:30", "Marketing"], ["15:30–17:00", "Production / Product Development"], ["17:00–17:30", "Inventory & Operations"], ["17:30–18:30", "Sales & Customer Growth"], ["18:30–19:15", "Business Improvement"], ["19:15–20:00", "Closing"]];

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState("Today");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [orderModal, setOrderModal] = useState(false);
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    loadBusiness();
  }, [session]);

  async function loadBusiness() {
    setLoading(true);
    setMessage("");
    const { data: membership, error: memberError } = await supabase
      .from("business_members")
      .select("business_id")
      .eq("user_id", session.user.id)
      .limit(1)
      .maybeSingle();
    if (memberError) { setMessage(memberError.message); setLoading(false); return; }
    if (!membership) { setMessage("No business was found for this account. Please sign out and sign up again, or run schema_v2.sql."); setLoading(false); return; }
    setBusinessId(membership.business_id);
    await Promise.all([loadTasks(membership.business_id), loadOrders(membership.business_id)]);
    setLoading(false);
  }

  async function loadTasks(id = businessId) {
    if (!id) return;
    const { data, error } = await supabase.from("tasks").select("id,title,status,category").eq("business_id", id).order("created_at", { ascending: true });
    if (error) setMessage(error.message); else setTasks((data || []) as Task[]);
  }

  async function loadOrders(id = businessId) {
    if (!id) return;
    const { data, error } = await supabase.from("orders").select("id,order_date,required_time,status,payment_status,total,customers(name)").eq("business_id", id).order("created_at", { ascending: false }).limit(20);
    if (error) setMessage(error.message); else setOrders((data || []) as unknown as Order[]);
  }

  async function addTask(title: string) {
    if (!businessId || !title.trim()) return;
    const { error } = await supabase.from("tasks").insert({ business_id: businessId, title: title.trim(), category: "Business", scheduled_date: new Date().toISOString().slice(0, 10) });
    if (error) setMessage(error.message); else await loadTasks();
  }

  async function toggleTask(task: Task) {
    const next = task.status === "Completed" ? "Not Started" : "Completed";
    const { error } = await supabase.from("tasks").update({ status: next, completed_at: next === "Completed" ? new Date().toISOString() : null }).eq("id", task.id);
    if (error) setMessage(error.message); else setTasks(ts => ts.map(t => t.id === task.id ? { ...t, status: next } : t));
  }

  async function signOut() { await supabase.auth.signOut(); setSession(null); setBusinessId(null); setOrders([]); setTasks([]); }

  if (authLoading) return <main><div className="card auth-card"><h2>Loading…</h2></div></main>;
  if (!session) return <AuthScreen mode={authMode} setMode={setAuthMode} />;

  const done = tasks.filter(t => t.status === "Completed").length;
  const progress = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter(o => o.order_date === today);
  const todaySales = todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  return <main>
    <header className="top">
      <div><small>DESSERT BUSINESS OS</small><h1>Good morning 👋</h1><p>{new Date().toLocaleDateString("en-MY", { day: "numeric", month: "long" })} · Business day 11:00–20:00</p></div>
      <div className="header-actions"><button onClick={() => setOrderModal(true)}>+ Add order</button><button className="alt" onClick={signOut}><LogOut size={16}/> Sign out</button></div>
    </header>
    {message && <div className="notice">{message}<button onClick={() => setMessage("")}><X size={15}/></button></div>}
    {loading && <div className="loading">Syncing with Supabase…</div>}

    {tab === "Today" && <>
      <section className="grid hero"><div className="card now"><small>RIGHT NOW</small><h2>Production</h2><b>11:30–13:00</b><p>Prepare today's ingredients, fillings, packaging and scheduled orders.</p><button onClick={() => setRunning(!running)}>{running ? "Pause" : "Start"}</button> {running && <span className="running">● Running</span>}</div><div className="card"><Stat n={`RM ${todaySales.toFixed(2)}`} l="Today's sales"/><Stat n={String(todayOrders.length)} l="Orders"/><Stat n="—" l="Low-stock items"/></div></section>
      <section className="grid two"><div className="card"><div className="row"><h3>Today's priorities</h3><b>{progress}%</b></div><div className="bar"><i style={{width: `${progress}%`}}/></div>{tasks.map(t => <div className="task" key={t.id} onClick={() => toggleTask(t)}><span className={t.status === "Completed" ? "check done" : "check"}>{t.status === "Completed" && <CheckCircle2 size={15}/>}</span><div><strong className={t.status === "Completed" ? "strike" : ""}>{t.title}</strong><small>{t.category || "Business"}</small></div></div>)}<button className="alt full" onClick={() => setTaskModal(true)}>+ Add task</button></div>
      <div className="card"><h3>Business snapshot</h3><Metric a="Today's sales" b={`RM ${todaySales.toFixed(2)}`}/><Metric a="Today's orders" b={String(todayOrders.length)}/><Metric a="Completed tasks" b={`${done}/${tasks.length}`}/><div className="forecast"><TrendingUp/><div><b>Forecasting</b><strong>Collecting real sales data</strong><small>Forecasts will become meaningful after enough historical orders are recorded.</small></div></div></div></section>
      <section className="card schedule"><h3>Upcoming schedule</h3>{schedule.slice(2, 7).map((s, i) => <div className="sched" key={i}><span>{s[0]}</span><b>{s[1]}</b></div>)}</section>
    </>}

    {tab === "Orders" && <OrdersView orders={orders} onAdd={() => setOrderModal(true)} onRefresh={() => loadOrders()} />}
    {tab === "Business" && <BusinessView orders={orders} />}
    {tab === "Content" && <section className="grid two"><div className="card"><h3>Content planner</h3><Metric a="Posts this week" b="0"/><Metric a="Ideas" b="0"/><Metric a="Status" b="Ready for real data"/></div><div className="card"><h3>Next content</h3><p>Add content records later. The database is ready for this module.</p></div></section>}

    <nav>{[["Today", CalendarDays], ["Orders", ShoppingBag], ["Business", BarChart3], ["Content", ClipboardList]].map(([n, I]) => <button className={tab === n ? "active" : ""} key={String(n)} onClick={() => setTab(String(n))}><I size={19}/>{String(n)}</button>)}</nav>
    {taskModal && <TaskModal onClose={() => setTaskModal(false)} onAdd={async title => { await addTask(title); setTaskModal(false); }} />}
    {orderModal && <OrderModal businessId={businessId!} onClose={() => setOrderModal(false)} onSaved={async () => { setOrderModal(false); await loadOrders(); }} onError={setMessage} />}
  </main>;
}

function AuthScreen({ mode, setMode }: { mode: "login" | "signup"; setMode: (m: "login" | "signup") => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError("");
    const result = mode === "login" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (result.error) setError(result.error.message); else if (mode === "signup") setError("Account created. If email confirmation is enabled, confirm your email, then log in.");
    setBusy(false);
  }
  return <main><div className="auth-wrap"><div className="card auth-card"><small>DESSERT BUSINESS OS</small><h1>{mode === "login" ? "Welcome back" : "Create your business account"}</h1><p>Securely connect the app to your Supabase database.</p><form onSubmit={submit}>{mode === "signup" && <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required />}<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required/><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (min. 6 characters)" minLength={6} required/><button disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button></form>{error && <div className="error">{error}</div>}<button className="link-button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Create a new account" : "Already have an account? Sign in"}</button></div></div></main>;
}

function OrdersView({ orders, onAdd, onRefresh }: { orders: Order[]; onAdd: () => void; onRefresh: () => void }) {
  return <section className="card"><div className="row"><div><h3>Orders</h3><p>Real orders stored in Supabase.</p></div><div><button onClick={onAdd}>+ Add order</button> <button className="alt" onClick={onRefresh}>Refresh</button></div></div>{orders.length === 0 ? <div className="empty"><ShoppingBag size={30}/><p>No orders yet.</p><button onClick={onAdd}>Create your first order</button></div> : orders.map(o => <div className="order" key={o.id}><ShoppingBag size={18}/><span><b>{o.customers?.name || "Walk-in customer"}</b><small>{o.order_date}{o.required_time ? ` · ${o.required_time.slice(0, 5)}` : ""} · {o.status} · {o.payment_status}</small></span><strong>RM {Number(o.total).toFixed(2)}</strong></div>)}</section>;
}

function BusinessView({ orders }: { orders: Order[] }) { const revenue = orders.reduce((s, o) => s + Number(o.total || 0), 0); return <section className="grid three"><div className="card"><h3>Sales</h3><strong className="big">RM {revenue.toFixed(2)}</strong><p>Loaded from current order records</p></div><div className="card"><h3>Orders</h3><strong className="big">{orders.length}</strong><p>Recent orders</p></div><div className="card"><h3>Forecast</h3><strong className="big">—</strong><p>Needs historical data</p></div><div className="card wide"><h3>Next analytics milestone</h3><p>Once enough orders are recorded, we'll calculate daily/weekly revenue, average order value, product performance and deterministic forecasts.</p></div></section>; }

function TaskModal({ onClose, onAdd }: { onClose: () => void; onAdd: (title: string) => Promise<void> }) { const [title, setTitle] = useState(""); return <div className="modal"><div className="modalbox"><h3>Add task</h3><input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Test new brownie topping" onKeyDown={e => e.key === "Enter" && onAdd(title)}/><button onClick={() => onAdd(title)}>Add</button> <button className="alt" onClick={onClose}>Cancel</button></div></div>; }

function OrderModal({ businessId, onClose, onSaved, onError }: { businessId: string; onClose: () => void; onSaved: () => Promise<void>; onError: (s: string) => void }) {
  const [customer, setCustomer] = useState(""); const [product, setProduct] = useState(""); const [qty, setQty] = useState("1"); const [price, setPrice] = useState(""); const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [time, setTime] = useState(""); const [status, setStatus] = useState("New"); const [payment, setPayment] = useState("Unpaid"); const [busy, setBusy] = useState(false);
  async function save(e: FormEvent) { e.preventDefault(); setBusy(true); onError(""); const quantity = Number(qty); const unitPrice = Number(price); if (!customer.trim() || !product.trim() || !quantity || !unitPrice) { onError("Please fill customer, product, quantity and price."); setBusy(false); return; }
    try {
      let customerId: string | null = null;
      const existing = await supabase.from("customers").select("id").eq("business_id", businessId).ilike("name", customer.trim()).limit(1).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) customerId = existing.data.id;
      else { const created = await supabase.from("customers").insert({ business_id: businessId, name: customer.trim() }).select("id").single(); if (created.error) throw created.error; customerId = created.data.id; }

      let productId: string | null = null;
      const existingProduct = await supabase.from("products").select("id").eq("business_id", businessId).ilike("name", product.trim()).limit(1).maybeSingle();
      if (existingProduct.error) throw existingProduct.error;
      if (existingProduct.data) productId = existingProduct.data.id;
      else { const createdProduct = await supabase.from("products").insert({ business_id: businessId, name: product.trim(), selling_price: unitPrice }).select("id").single(); if (createdProduct.error) throw createdProduct.error; productId = createdProduct.data.id; }

      const total = quantity * unitPrice;
      const createdOrder = await supabase.from("orders").insert({ business_id: businessId, customer_id: customerId, order_date: date, required_time: time || null, status, payment_status: payment, total }).select("id").single();
      if (createdOrder.error) throw createdOrder.error;
      const item = await supabase.from("order_items").insert({ order_id: createdOrder.data.id, product_id: productId, quantity, unit_price: unitPrice });
      if (item.error) { await supabase.from("orders").delete().eq("id", createdOrder.data.id); throw item.error; }
      await onSaved();
    } catch (err: any) { onError(err?.message || "Could not save the order."); }
    finally { setBusy(false); }
  }
  return <div className="modal"><div className="modalbox large"><div className="row"><h3>Add order</h3><button className="icon-button" onClick={onClose}><X size={18}/></button></div><form className="form-grid" onSubmit={save}><input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer name" required/><input value={product} onChange={e => setProduct(e.target.value)} placeholder="Product name" required/><input type="number" min="0.01" step="0.01" value={qty} onChange={e => setQty(e.target.value)} placeholder="Quantity" required/><input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="Unit price (RM)" required/><input type="date" value={date} onChange={e => setDate(e.target.value)} required/><input type="time" value={time} onChange={e => setTime(e.target.value)}/><select value={status} onChange={e => setStatus(e.target.value)}><option>New</option><option>Confirmed</option><option>In Progress</option><option>Ready</option><option>Completed</option><option>Cancelled</option></select><select value={payment} onChange={e => setPayment(e.target.value)}><option>Unpaid</option><option>Deposit Paid</option><option>Paid</option></select><div className="form-actions"><button disabled={busy}>{busy ? "Saving…" : "Save order"}</button><button type="button" className="alt" onClick={onClose}>Cancel</button></div></form></div></div>;
}

function Stat({ n, l }: { n: string; l: string }) { return <div className="stat"><AlertTriangle size={19}/><div><small>{l}</small><b>{n}</b></div></div>; }
function Metric({ a, b }: { a: string; b: string }) { return <div className="metric"><span>{a}</span><b>{b}</b></div>; }
