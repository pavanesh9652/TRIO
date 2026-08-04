import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ReceiptModal from '../components/ReceiptModal';

const STATUSES = ['placed', 'preparing', 'served', 'paid', 'cancelled'];

// Mirrors the transitions the API enforces, so we only offer valid buttons.
const NEXT_ACTIONS = {
  placed: ['preparing', 'served', 'cancelled'],
  preparing: ['served', 'cancelled'],
  served: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
};

const money = (n) => `₹${Number(n || 0).toFixed(2)}`;
const when = (iso) => new Date(iso).toLocaleString();

export default function Orders() {
  const { isAdmin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [openLogs, setOpenLogs] = useState(null);
  const [logs, setLogs] = useState([]);
  const [receiptOrder, setReceiptOrder] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/orders', {
        params: { status: status || undefined, mine: mine ? 'true' : undefined, page, limit: 20 },
      });
      setOrders(data.orders);
      setPages(data.pages);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status, mine, page]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (order, next) => {
    try {
      const { data } = await api.patch(`/orders/${order._id}/status`, { status: next });
      setOrders((current) => current.map((o) => (o._id === data._id ? data : o)));
      if (openLogs === order._id) showLogs(order._id);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const showLogs = async (orderId) => {
    if (openLogs === orderId) {
      setOpenLogs(null);
      return;
    }
    try {
      const { data } = await api.get(`/orders/${orderId}/logs`);
      setLogs(data);
      setOpenLogs(orderId);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Orders</h2>
        <div className="filters">
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={mine}
              onChange={(e) => {
                setPage(1);
                setMine(e.target.checked);
              }}
            />
            Only mine
          </label>
          <button className="btn btn-ghost" onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="empty">Loading orders…</p>}
      {!loading && orders.length === 0 && <p className="empty">No orders yet.</p>}

      <div className="order-list">
        {orders.map((order) => (
          <article key={order._id} className="order-card">
            <div className="order-card-head">
              <div>
                <strong>{order.orderNumber}</strong>
                <span className="muted"> · Table {order.tableNumber}</span>
              </div>
              <span className={`badge badge-${order.status}`}>{order.status}</span>
            </div>

            <ul className="order-items">
              {order.items.map((item, index) => (
                <li key={`${order._id}-${index}`}>
                  <span>
                    {item.quantity} × {item.name}
                    {item.notes && <em className="muted"> — {item.notes}</em>}
                  </span>
                  <span>{money(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>

            {order.notes && <p className="order-note">Note: {order.notes}</p>}

            <div className="order-card-foot">
              <span className="muted">
                {order.waiterName} · {when(order.createdAt)}
              </span>
              <strong>{money(order.total)}</strong>
            </div>

            <div className="order-actions">
              {NEXT_ACTIONS[order.status].map((next) => (
                <button
                  key={next}
                  className={`btn btn-sm ${next === 'cancelled' ? 'btn-danger' : 'btn-primary'}`}
                  onClick={() => updateStatus(order, next)}
                >
                  Mark {next}
                </button>
              ))}
              <button className="btn btn-sm btn-ghost" onClick={() => setReceiptOrder(order)}>
                🖨 Receipt
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => showLogs(order._id)}>
                {openLogs === order._id ? 'Hide history' : 'History'}
              </button>
            </div>

            {openLogs === order._id && (
              <ol className="log-trail">
                {logs.map((log) => (
                  <li key={log._id}>
                    <span className="muted">{when(log.createdAt)}</span>
                    <span>
                      <strong>{log.action}</strong> — {log.message}
                      <em className="muted"> ({log.performedByName})</em>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </article>
        ))}
      </div>

      {pages > 1 && (
        <div className="pager">
          <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            className="btn btn-ghost"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}

      {receiptOrder && (
        <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
      )}

      {isAdmin && (
        <p className="muted footnote">
          Every status change above is written to the order log, viewable under Order Logs.
        </p>
      )}
    </div>
  );
}
