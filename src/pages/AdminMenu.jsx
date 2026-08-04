import { useEffect, useState } from 'react';
import api, { errorMessage } from '../api/client';

const EMPTY_FORM = { name: '', category: '', price: '', description: '', available: true };
const money = (n) => `₹${Number(n || 0).toFixed(2)}`;

export default function AdminMenu() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get('/menu');
      setItems(data);
    } catch (err) {
      setFeedback({ type: 'error', text: errorMessage(err) });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const change = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setForm({
      name: item.name,
      category: item.category,
      price: String(item.price),
      description: item.description || '',
      available: item.available,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event) => {
    event.preventDefault();
    setFeedback(null);
    setBusy(true);
    try {
      const payload = { ...form, price: Number(form.price) };
      if (editingId) {
        await api.put(`/menu/${editingId}`, payload);
        setFeedback({ type: 'success', text: `"${payload.name}" updated` });
      } else {
        await api.post('/menu', payload);
        setFeedback({ type: 'success', text: `"${payload.name}" added to the menu` });
      }
      resetForm();
      load();
    } catch (err) {
      setFeedback({ type: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const toggleAvailable = async (item) => {
    try {
      await api.put(`/menu/${item._id}`, { available: !item.available });
      load();
    } catch (err) {
      setFeedback({ type: 'error', text: errorMessage(err) });
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Remove "${item.name}" from the menu?`)) return;
    try {
      const { data } = await api.delete(`/menu/${item._id}`);
      setFeedback({ type: 'success', text: data.message });
      if (editingId === item._id) resetForm();
      load();
    } catch (err) {
      setFeedback({ type: 'error', text: errorMessage(err) });
    }
  };

  return (
    <div className="admin-layout">
      <section className="panel">
        <div className="panel-head">
          <h2>{editingId ? 'Update item' : 'Add new item'}</h2>
          {editingId && (
            <button className="btn btn-ghost" onClick={resetForm}>
              Cancel edit
            </button>
          )}
        </div>

        {feedback && <div className={`alert alert-${feedback.type}`}>{feedback.text}</div>}

        <form onSubmit={submit} className="stack">
          <label className="field">
            Item name
            <input value={form.name} onChange={change('name')} required />
          </label>

          <label className="field">
            Category
            <input
              value={form.category}
              onChange={change('category')}
              placeholder="Coffee, Snacks, Desserts…"
              list="category-options"
            />
            <datalist id="category-options">
              {Array.from(new Set(items.map((i) => i.category))).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label className="field">
            Price (₹)
            <input type="number" min="0" step="1" value={form.price} onChange={change('price')} required />
          </label>

          <label className="field">
            Description
            <textarea rows={2} value={form.description} onChange={change('description')} />
          </label>

          <label className="checkbox">
            <input type="checkbox" checked={form.available} onChange={change('available')} />
            Available for ordering
          </label>

          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add to menu'}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Menu ({items.length})</h2>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Price</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id} className={item.available ? '' : 'row-muted'}>
                  <td data-label="Item">
                    <div>
                      <strong>{item.name}</strong>
                      {item.description && <div className="muted small">{item.description}</div>}
                    </div>
                  </td>
                  <td data-label="Category">{item.category}</td>
                  <td data-label="Price">{money(item.price)}</td>
                  <td data-label="Status">
                    <button
                      className={`badge badge-${item.available ? 'served' : 'cancelled'} badge-btn`}
                      onClick={() => toggleAvailable(item)}
                      title="Click to toggle"
                    >
                      {item.available ? 'available' : 'hidden'}
                    </button>
                  </td>
                  <td className="row-actions" data-label="Actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => startEdit(item)}>
                      Edit
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(item)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    No menu items yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
