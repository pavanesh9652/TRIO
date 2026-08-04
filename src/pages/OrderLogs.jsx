import { Fragment, useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/client';

const ACTIONS = ['created', 'status_changed', 'items_updated', 'cancelled'];
const money = (n) => `₹${Number(n || 0).toFixed(2)}`;
const when = (iso) => new Date(iso).toLocaleString();

export default function OrderLogs() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ action: '', orderNumber: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/orders/logs', {
        params: {
          action: filters.action || undefined,
          orderNumber: filters.orderNumber || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
          page,
          limit: 50,
        },
      });
      setLogs(data.logs);
      setPages(data.pages);
      setTotal(data.total);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .get('/orders/stats')
      .then(({ data }) => setStats(data))
      .catch(() => setStats(null));
  }, []);

  const change = (key) => (event) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: event.target.value }));
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Order Logs</h2>
        <span className="muted">{total} entries</span>
      </div>

      {stats && (
        <div className="stat-row">
          <div className="stat">
            <span>Orders today</span>
            <strong>{stats.orders}</strong>
          </div>
          <div className="stat">
            <span>Revenue today</span>
            <strong>{money(stats.revenue)}</strong>
          </div>
          <div className="stat">
            <span>Open orders</span>
            <strong>{stats.open}</strong>
          </div>
          <div className="stat">
            <span>Menu items</span>
            <strong>{stats.menuItems}</strong>
          </div>
        </div>
      )}

      <div className="filters filters-wrap">
        <select value={filters.action} onChange={change('action')}>
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          placeholder="Order number"
          value={filters.orderNumber}
          onChange={change('orderNumber')}
        />
        <label className="inline-field">
          From
          <input type="date" value={filters.from} onChange={change('from')} />
        </label>
        <label className="inline-field">
          To
          <input type="date" value={filters.to} onChange={change('to')} />
        </label>
        <button className="btn btn-ghost" onClick={load}>
          Refresh
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Order</th>
              <th>Action</th>
              <th>Details</th>
              <th>By</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <Fragment key={log._id}>
                <tr>
                  <td className="nowrap" data-label="When">
                    {when(log.createdAt)}
                  </td>
                  <td data-label="Order">
                    <strong>{log.orderNumber}</strong>
                  </td>
                  <td data-label="Action">
                    <span className="badge badge-neutral">{log.action}</span>
                  </td>
                  <td data-label="Details">{log.message}</td>
                  <td data-label="By">
                    <div>
                      {log.performedByName}
                      <div className="muted small">{log.performedByRole}</div>
                    </div>
                  </td>
                  <td data-label="">
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => setExpanded(expanded === log._id ? null : log._id)}
                    >
                      {expanded === log._id ? 'Hide' : 'Snapshot'}
                    </button>
                  </td>
                </tr>
                {expanded === log._id && (
                  <tr>
                    <td colSpan={6} className="snapshot-cell">
                      <div className="snapshot">
                        <div>
                          <strong>Table {log.snapshot?.tableNumber}</strong> ·{' '}
                          {log.snapshot?.status} · {money(log.snapshot?.total)}
                        </div>
                        <ul>
                          {(log.snapshot?.items || []).map((item, index) => (
                            <li key={index}>
                              {item.quantity} × {item.name} @ {money(item.price)}
                              {item.notes ? ` — ${item.notes}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  No log entries for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
    </div>
  );
}
