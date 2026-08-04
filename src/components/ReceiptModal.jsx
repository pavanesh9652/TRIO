import { useEffect, useMemo } from 'react';
import { downloadReceipt, printReceipt, receiptDataUrl } from '../utils/receipt';
import { lockScroll, unlockScroll } from '../utils/scrollLock';

export default function ReceiptModal({ order, onClose }) {
  const image = useMemo(() => (order ? receiptDataUrl(order) : null), [order]);

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    lockScroll();
    return () => {
      window.removeEventListener('keydown', onKey);
      unlockScroll();
    };
  }, [onClose]);

  if (!order) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h2>Receipt · {order.orderNumber}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="receipt-preview">
          <img src={image} alt={`Receipt for order ${order.orderNumber}`} />
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => printReceipt(order)}>
            🖨 Print
          </button>
          <button className="btn btn-ghost" onClick={() => downloadReceipt(order)}>
            ⬇ Save as image
          </button>
        </div>
      </div>
    </div>
  );
}
