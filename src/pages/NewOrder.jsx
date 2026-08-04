import { useEffect, useMemo, useState } from 'react';
import api, { errorMessage } from '../api/client';
import ReceiptModal from '../components/ReceiptModal';
import { printReceipt } from '../utils/receipt';
import { lockScroll, unlockScroll } from '../utils/scrollLock';

const TAX_PERCENT = 5;
const money = (n) => `₹${Number(n || 0).toFixed(2)}`;

export default function NewOrder() {
  const [menu, setMenu] = useState([]);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [tableNumber, setTableNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);
  // On phones the cart is a bottom sheet instead of a sidebar.
  const [cartOpen, setCartOpen] = useState(false);
  // The order just placed, kept so its receipt can be printed or saved.
  const [placedOrder, setPlacedOrder] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Stop the page behind the sheet from scrolling while it is open.
  useEffect(() => {
    if (!cartOpen) return undefined;
    lockScroll();
    return unlockScroll;
  }, [cartOpen]);

  useEffect(() => {
    api
      .get('/menu', { params: { availableOnly: true } })
      .then(({ data }) => setMenu(data))
      .catch((err) => setFeedback({ type: 'error', text: errorMessage(err) }));
  }, []);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(menu.map((m) => m.category))).sort()],
    [menu]
  );

  const visibleMenu = useMemo(
    () =>
      menu.filter(
        (item) =>
          (category === 'All' || item.category === category) &&
          item.name.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [menu, category, search]
  );

  const addToCart = (item) => {
    setCart((current) => {
      const existing = current.find((line) => line.menuItem === item._id);
      if (existing) {
        return current.map((line) =>
          line.menuItem === item._id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [
        ...current,
        { menuItem: item._id, name: item.name, price: item.price, quantity: 1, notes: '' },
      ];
    });
  };

  const changeQty = (id, delta) =>
    setCart((current) =>
      current
        .map((line) =>
          line.menuItem === id ? { ...line, quantity: line.quantity + delta } : line
        )
        .filter((line) => line.quantity > 0)
    );

  const setLineNotes = (id, value) =>
    setCart((current) =>
      current.map((line) => (line.menuItem === id ? { ...line, notes: value } : line))
    );

  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const tax = (subtotal * TAX_PERCENT) / 100;
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  const placeOrder = async () => {
    setFeedback(null);
    if (!tableNumber.trim()) {
      setCartOpen(true);
      return setFeedback({ type: 'error', text: 'Enter a table number' });
    }
    if (cart.length === 0) {
      return setFeedback({ type: 'error', text: 'Add at least one item' });
    }

    setBusy(true);
    try {
      const { data } = await api.post('/orders', {
        tableNumber: tableNumber.trim(),
        notes,
        items: cart.map(({ menuItem, quantity, notes: lineNotes }) => ({
          menuItem,
          quantity,
          notes: lineNotes,
        })),
      });
      setFeedback({
        type: 'success',
        text: `${data.orderNumber} placed for table ${data.tableNumber} — ${money(data.total)}`,
      });
      setPlacedOrder(data);
      setShowReceipt(true);
      setCartOpen(false);
      setCart([]);
      setTableNumber('');
      setNotes('');
    } catch (err) {
      setFeedback({ type: 'error', text: errorMessage(err, 'Could not place the order') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="order-layout">
      <section className="panel">
        <div className="panel-head">
          <h2>Menu</h2>
          <input
            className="search"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="chips">
          {categories.map((name) => (
            <button
              key={name}
              className={`chip ${category === name ? 'chip-active' : ''}`}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="menu-grid">
          {visibleMenu.map((item) => (
            <button key={item._id} className="menu-card" onClick={() => addToCart(item)}>
              <span className="menu-card-name">{item.name}</span>
              <span className="menu-card-cat">{item.category}</span>
              {item.description && <span className="menu-card-desc">{item.description}</span>}
              <span className="menu-card-price">{money(item.price)}</span>
            </button>
          ))}
          {visibleMenu.length === 0 && <p className="empty">No items match this filter.</p>}
        </div>
      </section>

      {cartOpen && <div className="sheet-backdrop" onClick={() => setCartOpen(false)} />}

      <aside className={`panel cart ${cartOpen ? 'cart-open' : ''}`}>
        <div className="panel-head">
          <h2>Current Order</h2>
          <div className="head-actions">
            {cart.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setCart([])}>
                Clear
              </button>
            )}
            <button className="btn btn-ghost btn-sm sheet-close" onClick={() => setCartOpen(false)}>
              Close
            </button>
          </div>
        </div>

        {feedback && <div className={`alert alert-${feedback.type}`}>{feedback.text}</div>}

        {placedOrder && (
          <div className="last-receipt">
            <span>
              Last order <strong>{placedOrder.orderNumber}</strong>
            </span>
            <div className="head-actions">
              <button className="btn btn-sm btn-ghost" onClick={() => setShowReceipt(true)}>
                Receipt
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => printReceipt(placedOrder)}>
                🖨 Print
              </button>
            </div>
          </div>
        )}

        <label className="field">
          Table number
          <input
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            placeholder="e.g. 7"
          />
        </label>

        <div className="cart-lines">
          {cart.length === 0 && <p className="empty">Tap a menu item to add it here.</p>}
          {cart.map((line) => (
            <div key={line.menuItem} className="cart-line">
              <div className="cart-line-top">
                <span className="cart-line-name">{line.name}</span>
                <span className="cart-line-total">{money(line.price * line.quantity)}</span>
              </div>
              <div className="cart-line-bottom">
                <div className="stepper">
                  <button onClick={() => changeQty(line.menuItem, -1)}>−</button>
                  <span>{line.quantity}</span>
                  <button onClick={() => changeQty(line.menuItem, 1)}>+</button>
                </div>
                <input
                  className="line-note"
                  placeholder="Note (e.g. no sugar)"
                  value={line.notes}
                  onChange={(e) => setLineNotes(line.menuItem, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        <label className="field">
          Order note
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the kitchen should know"
          />
        </label>

        <div className="totals">
          <div>
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <div>
            <span>Tax ({TAX_PERCENT}%)</span>
            <span>{money(tax)}</span>
          </div>
          <div className="grand">
            <span>Total</span>
            <span>{money(subtotal + tax)}</span>
          </div>
        </div>

        <button className="btn btn-primary btn-block" onClick={placeOrder} disabled={busy}>
          {busy ? 'Placing…' : 'Place Order'}
        </button>
      </aside>

      {/* Phone-only summary bar that opens the cart sheet. */}
      <button className="cart-bar" onClick={() => setCartOpen(true)}>
        <span>
          {itemCount > 0 ? `${itemCount} item${itemCount > 1 ? 's' : ''}` : 'No items yet'}
          {tableNumber.trim() && <em> · Table {tableNumber.trim()}</em>}
        </span>
        <span className="cart-bar-total">
          {money(subtotal + tax)} <strong>Review →</strong>
        </span>
      </button>

      {showReceipt && placedOrder && (
        <ReceiptModal order={placedOrder} onClose={() => setShowReceipt(false)} />
      )}
    </div>
  );
}
