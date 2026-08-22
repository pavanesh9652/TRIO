import { useEffect, useMemo, useState } from 'react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

const money = (n) => `₹${Number(n || 0).toFixed(2)}`;
const when = (iso) => new Date(iso).toLocaleString();
const toDateInputValue = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const parseLocalDate = (dateValue) => {
    if (!dateValue) return null;
    const [year, month, day] = dateValue.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
};
const getCurrentMonthRange = () => {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    return {
        from: toDateInputValue(from),
        to: toDateInputValue(to),
    };
};
const startOfWeek = (date) => {
    const value = new Date(date);
    const day = value.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    value.setHours(0, 0, 0, 0);
    value.setDate(value.getDate() + diff);
    return value;
};
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const weekKey = (date) => {
    const start = startOfWeek(date);
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
};
const formatShortMonth = (date) => date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
const formatShortWeek = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const dayKey = (iso) => {
    const date = new Date(iso);
    return toDateInputValue(date);
};
const dayLabel = (key) => {
    const localDate = parseLocalDate(key);
    return localDate.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

export default function Reports() {
    const { isAdmin } = useAuth();
    const [staff, setStaff] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [selectedBreakdown, setSelectedBreakdown] = useState(null);
    const [comparisonMode, setComparisonMode] = useState('week');
    const [filters, setFilters] = useState(() => ({
        ...getCurrentMonthRange(),
        status: '',
        waiter: '',
        item: '',
        mine: false,
    }));
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        api
            .get('/menu')
            .then(({ data }) => setMenuItems(data))
            .catch(() => setMenuItems([]));
    }, []);

    useEffect(() => {
        if (!isAdmin) {
            setFilters((current) => ({ ...current, mine: true }));
            return;
        }

        setFilters((current) => ({ ...current, mine: false }));

        api
            .get('/auth/staff')
            .then(({ data }) => setStaff(data))
            .catch(() => setStaff([]));
    }, [isAdmin]);

    useEffect(() => {
        const params = {
            from: filters.from || undefined,
            to: filters.to || undefined,
            status: filters.status || undefined,
            waiter: filters.waiter || undefined,
            item: filters.item || undefined,
            mine: filters.mine ? 'true' : undefined,
        };

        setLoading(true);
        api
            .get('/orders/report', { params })
            .then(({ data }) => {
                setReport(data);
                setError('');
            })
            .catch((err) => setError(errorMessage(err)))
            .finally(() => setLoading(false));
    }, [filters.from, filters.to, filters.status, filters.waiter, filters.item, filters.mine]);

    const dateBreakdown = useMemo(
        () =>
            (Array.isArray(report?.dateWise) ? report.dateWise : []).map((day) => ({
                ...day,
                totalOrders: Number(day.totalOrders || 0),
                totalItems: Number(day.totalItems || 0),
                totalRevenue: Number(day.totalRevenue || 0),
                orders: Array.isArray(day.orders) ? day.orders.map((order) => ({
                    orderNumber: order.orderNumber || 'Order',
                    status: order.status || 'placed',
                    total: Number(order.total || 0),
                })) : [],
                byStatus: {
                    placed: { count: Number(day.byStatus?.placed?.count || 0), revenue: Number(day.byStatus?.placed?.revenue || 0) },
                    preparing: { count: Number(day.byStatus?.preparing?.count || 0), revenue: Number(day.byStatus?.preparing?.revenue || 0) },
                    served: { count: Number(day.byStatus?.served?.count || 0), revenue: Number(day.byStatus?.served?.revenue || 0) },
                    paid: { count: Number(day.byStatus?.paid?.count || 0), revenue: Number(day.byStatus?.paid?.revenue || 0) },
                    cancelled: { count: Number(day.byStatus?.cancelled?.count || 0), revenue: Number(day.byStatus?.cancelled?.revenue || 0) },
                },
            })),
        [report]
    );

    const reportSummary = useMemo(() => {
        const totalOrders = dateBreakdown.reduce((sum, day) => sum + day.totalOrders, 0);
        const totalRevenue = dateBreakdown.reduce((sum, day) => sum + day.totalRevenue, 0);
        const openOrders = dateBreakdown.reduce(
            (sum, day) =>
                sum + Number(day.byStatus?.placed?.count || 0) + Number(day.byStatus?.preparing?.count || 0),
            0
        );

        return {
            totalOrders,
            totalRevenue,
            averageOrderValue: totalOrders ? totalRevenue / totalOrders : 0,
            openOrders,
        };
    }, [dateBreakdown]);

    const comparisonSeries = useMemo(() => {
        const rangeStart = parseLocalDate(filters.from) || new Date();
        const rangeEnd = parseLocalDate(filters.to) || new Date();
        const bucketMap = new Map();

        const addBucket = (key, label, dateValue) => {
            if (!bucketMap.has(key)) {
                bucketMap.set(key, {
                    key,
                    label,
                    dateValue,
                    revenue: 0,
                    orders: 0,
                });
            }
        };

        if (comparisonMode === 'month') {
            const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
            const endCursor = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
            while (cursor <= endCursor) {
                const label = formatShortMonth(cursor);
                addBucket(monthKey(cursor), label, new Date(cursor));
                cursor.setMonth(cursor.getMonth() + 1);
            }
        } else {
            const cursor = new Date(startOfWeek(rangeStart));
            const finalCursor = new Date(startOfWeek(rangeEnd));
            while (cursor <= finalCursor) {
                const label = `${formatShortWeek(cursor)} - ${formatShortWeek(new Date(cursor.getTime() + 6 * 86400000))}`;
                addBucket(weekKey(cursor), label, new Date(cursor));
                cursor.setDate(cursor.getDate() + 7);
            }
        }

        dateBreakdown.forEach((day) => {
            const entryDate = parseLocalDate(day.dateKey) || new Date();
            const key = comparisonMode === 'month' ? monthKey(entryDate) : weekKey(entryDate);
            const existing = bucketMap.get(key);
            if (existing) {
                existing.revenue += Number(day.totalRevenue || 0);
                existing.orders += Number(day.totalOrders || 0);
            } else {
                addBucket(key, comparisonMode === 'month' ? formatShortMonth(entryDate) : `${formatShortWeek(entryDate)} - ${formatShortWeek(new Date(entryDate.getTime() + 6 * 86400000))}`, entryDate);
                const created = bucketMap.get(key);
                created.revenue = Number(day.totalRevenue || 0);
                created.orders = Number(day.totalOrders || 0);
            }
        });

        return [...bucketMap.values()].sort((a, b) => new Date(a.dateValue) - new Date(b.dateValue));
    }, [comparisonMode, dateBreakdown, filters.from, filters.to]);

    const selectedRows = selectedBreakdown?.rows || [];

    const openBreakdown = (label, rows, type = 'items') => {
        setSelectedBreakdown({ label, type, rows });
    };

    return (
        <div className="panel">
            <div className="panel-head">
                <h2>Sales & Order Report</h2>
                <button
                    className="btn btn-ghost"
                    onClick={() =>
                        setFilters((current) => ({
                            ...current,
                            ...getCurrentMonthRange(),
                            status: '',
                            waiter: '',
                            item: '',
                            mine: !isAdmin ? true : false,
                        }))
                    }
                >
                    Reset filters
                </button>
            </div>

            <div className="filters filters-wrap">
                <label className="inline-field">
                    From
                    <input
                        type="date"
                        value={filters.from}
                        onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
                    />
                </label>

                <label className="inline-field">
                    To
                    <input
                        type="date"
                        value={filters.to}
                        onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
                    />
                </label>

                <select
                    value={filters.status}
                    onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                >
                    <option value="">All statuses</option>
                    <option value="placed">Placed</option>
                    <option value="preparing">Preparing</option>
                    <option value="served">Served</option>
                    <option value="paid">Paid</option>
                    <option value="cancelled">Cancelled</option>
                </select>

                <select
                    value={filters.item}
                    onChange={(event) => setFilters((current) => ({ ...current, item: event.target.value }))}
                >
                    <option value="">All items</option>
                    {menuItems.map((item) => (
                        <option key={item._id} value={item._id}>
                            {item.name}
                        </option>
                    ))}
                </select>

                {isAdmin && (
                    <select
                        value={filters.waiter}
                        onChange={(event) => setFilters((current) => ({ ...current, waiter: event.target.value }))}
                    >
                        <option value="">All waiters</option>
                        {staff.map((member) => (
                            <option key={member.id} value={member.id}>
                                {member.name}
                            </option>
                        ))}
                    </select>
                )}

                {!isAdmin && (
                    <label className="checkbox">
                        <input
                            type="checkbox"
                            checked={filters.mine}
                            onChange={(event) => setFilters((current) => ({ ...current, mine: event.target.checked }))}
                        />
                        My orders only
                    </label>
                )}

                {isAdmin && (
                    <label className="checkbox">
                        <input
                            type="checkbox"
                            checked={filters.mine}
                            onChange={(event) => setFilters((current) => ({ ...current, mine: event.target.checked }))}
                        />
                        Mine only
                    </label>
                )}
            </div>

            {selectedBreakdown && (
                <div className="modal-backdrop" onClick={() => setSelectedBreakdown(null)}>
                    <div className="modal" onClick={(event) => event.stopPropagation()}>
                        <div className="panel-head compact">
                            <h3>{selectedBreakdown.type === 'orders' ? 'Orders for' : 'Items for'} {selectedBreakdown.label}</h3>
                            <button type="button" className="btn btn-ghost" onClick={() => setSelectedBreakdown(null)}>
                                Close
                            </button>
                        </div>

                        <div className="receipt-preview" style={{ marginTop: '8px' }}>
                            {selectedRows.length === 0 ? (
                                <p className="empty">No data available.</p>
                            ) : selectedBreakdown.type === 'orders' ? (
                                <div className="report-list">
                                    {selectedRows.map((order) => (
                                        <div key={order.orderNumber} className="report-row">
                                            <div className="report-row-head">
                                                <span>{order.orderNumber}</span>
                                                <strong>{order.status}</strong>
                                            </div>
                                            <small>{money(order.total)}</small>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="report-list">
                                    {selectedRows.map((item) => (
                                        <div key={item.name} className="report-row">
                                            <div className="report-row-head">
                                                <span>{item.name}</span>
                                                <strong>{item.quantity}</strong>
                                            </div>
                                            <small>{money(item.revenue)}</small>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {error && <div className="alert alert-error">{error}</div>}

            {loading ? (
                <p className="empty">Loading report…</p>
            ) : !report ? (
                <p className="empty">No report available.</p>
            ) : (
                <>
                    <div className="stat-row report-grid">
                        <div className="stat">
                            <span>Total orders</span>
                            <strong>{reportSummary.totalOrders}</strong>
                        </div>
                        <div className="stat">
                            <span>Revenue</span>
                            <strong>{money(reportSummary.totalRevenue)}</strong>
                        </div>
                        <div className="stat">
                            <span>Avg. order</span>
                            <strong>{money(reportSummary.averageOrderValue)}</strong>
                        </div>
                        <div className="stat">
                            <span>Open orders</span>
                            <strong>{reportSummary.openOrders}</strong>
                        </div>
                    </div>

                    <section className="panel comparison-panel">
                        <div className="panel-head compact">
                            <div>
                                <h3>{comparisonMode === 'month' ? 'Month-wise comparison' : 'Week-wise comparison'}</h3>
                                <small className="muted-copy">
                                    {comparisonSeries.length} {comparisonMode === 'month' ? `month${comparisonSeries.length === 1 ? '' : 's'}` : `week${comparisonSeries.length === 1 ? '' : 's'} `} in selected range
                                </small>
                            </div>
                            <select
                                value={comparisonMode}
                                onChange={(event) => setComparisonMode(event.target.value)}
                                className="comparison-select"
                            >
                                <option value="month">Month wise</option>
                                <option value="week">Week wise</option>
                            </select>
                        </div>

                        {comparisonSeries.length > 0 && (
                            <div className="line-chart-wrap">
                                <svg viewBox="0 0 700 220" className="line-chart" preserveAspectRatio="none">
                                    <line x1="30" x2="670" y1="180" y2="180" className="chart-axis" />
                                    <line x1="30" x2="30" y1="20" y2="180" className="chart-axis" />
                                    {comparisonSeries.map((point, index) => {
                                        const maxValue = Math.max(...comparisonSeries.map((item) => item.revenue || 0), 1);
                                        const x = 40 + (index * (620 / Math.max(comparisonSeries.length - 1, 1)));
                                        const y = 170 - (((point.revenue || 0) / maxValue) * 130);
                                        return (
                                            <g key={point.key}>
                                                {index > 0 && (
                                                    <line
                                                        x1={40 + ((index - 1) * (620 / Math.max(comparisonSeries.length - 1, 1)))}
                                                        y1={170 - (((comparisonSeries[index - 1].revenue || 0) / maxValue) * 130)}
                                                        x2={x}
                                                        y2={y}
                                                        className="chart-line"
                                                    />
                                                )}
                                                <circle cx={x} cy={y} r="5" className="chart-point" />
                                                <text x={x} y={y - 12} textAnchor="middle" className="chart-value">
                                                    {money(point.revenue)}
                                                </text>
                                                <text x={x} y="200" textAnchor="middle" className="chart-label">
                                                    {point.label}
                                                </text>
                                            </g>
                                        );
                                    })}
                                </svg>
                            </div>
                        )}
                    </section>

                    <section className="panel report-table-panel">
                        <div className="panel-head compact">
                            <h3>Date-wise summary</h3>
                        </div>

                        <div className="table-wrap">
                            <table className="table report-summary-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Placed</th>
                                        <th>Preparing</th>
                                        <th>Served</th>
                                        <th>Paid</th>
                                        <th>Cancelled</th>
                                        <th>Total Orders</th>
                                        <th>Items</th>
                                        <th>Total Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dateBreakdown.map((day) => (
                                        <tr key={day.dateKey}>
                                            <td data-label="Date"><strong>{day.label}</strong></td>
                                            <td data-label="Placed">
                                                <div className="status-cell">
                                                    <span>{day.byStatus.placed.count}</span>
                                                    <small>{money(day.byStatus.placed.revenue)}</small>
                                                </div>
                                            </td>
                                            <td data-label="Preparing">
                                                <div className="status-cell">
                                                    <span>{day.byStatus.preparing.count}</span>
                                                    <small>{money(day.byStatus.preparing.revenue)}</small>
                                                </div>
                                            </td>
                                            <td data-label="Served">
                                                <div className="status-cell">
                                                    <span>{day.byStatus.served.count}</span>
                                                    <small>{money(day.byStatus.served.revenue)}</small>
                                                </div>
                                            </td>
                                            <td data-label="Paid">
                                                <div className="status-cell">
                                                    <span>{day.byStatus.paid.count}</span>
                                                    <small>{money(day.byStatus.paid.revenue)}</small>
                                                </div>
                                            </td>
                                            <td data-label="Cancelled">
                                                <div className="status-cell cancel-status">
                                                    <span>{day.byStatus.cancelled.count}</span>
                                                    <small>{money(day.byStatus.cancelled.revenue)}</small>
                                                </div>
                                            </td>
                                            <td data-label="Total Orders">
                                                <button
                                                    type="button"
                                                    className="stat-count-button"
                                                    onClick={() => openBreakdown(day.label, day.orders || [], 'orders')}
                                                >
                                                    {day.totalOrders}
                                                </button>
                                            </td>
                                            <td data-label="Items">
                                                <button
                                                    type="button"
                                                    className="stat-count-button"
                                                    onClick={() => openBreakdown(day.label, day.items || [], 'items')}
                                                >
                                                    {day.totalItems}
                                                </button>
                                            </td>
                                            <td data-label="Total Revenue"><strong>{money(day.totalRevenue)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
