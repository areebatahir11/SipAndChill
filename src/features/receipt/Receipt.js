import './receipt.css';
import PrintControls from './PrintControls';
import { dateTime } from '@/lib/format';

/** Compact receipt. Plain CSS (receipt.css) so it prints identically on any thermal printer driver. */
export default function Receipt({ model: r, width, orderId, autoprint }) {
  return (
    <div className="receipt-page">
      {/* @page must carry the paper width so the browser does not add A4 margins to a roll. */}
      <style>{`@page { size: ${width}mm auto; margin: 0; }`}</style>
      <PrintControls orderId={orderId} width={width} autoprint={autoprint} model={r} />

      <article className={`receipt w${width}`} aria-label={`Receipt for order ${r.orderNo}`}>
        <header className="center">
          <h1 className="biz">{r.businessName}</h1>
          {r.address && <div>{r.address}</div>}
          {r.phone && <div>Tel: {r.phone}</div>}
        </header>
        <hr />
        {r.cancelled && <div className="center banner">*** CANCELLED ***</div>}
        <div className="meta">
          <div><span>Order #</span><b>{r.orderNo}</b></div>
          <div><span>Date</span><span>{dateTime(r.createdAt)}</span></div>
          <div><span>Cashier</span><span>{r.cashierName}</span></div>
        </div>
        <hr />
        <div className="items">
          {r.lines.map((l, i) => (
            <div key={i} className="item">
              <div className="name">{l.name}</div>
              <div className="row"><span>{l.quantity} x {l.unitPrice}</span><span>{l.lineTotal}</span></div>
            </div>
          ))}
        </div>
        <hr />
        <div className="totals">
          <div className="row"><span>Subtotal</span><span>{r.subtotal}</span></div>
          {r.discount && <div className="row"><span>Discount</span><span>- {r.discount}</span></div>}
          <div className="row grand"><span>TOTAL</span><span>{r.total}</span></div>
          <div className="row"><span>Amount Received</span><span>{r.received}</span></div>
          <div className="row"><span>Change Returned</span><span>{r.change}</span></div>
          {r.hasOutstanding && !r.cancelled && <div className="row"><b>Outstanding Amount</b><b>{r.outstanding}</b></div>}
          <div className="row"><span>Payment Status</span><b>{r.paymentStatus === 'PAID' ? 'PAID' : r.paymentStatus === 'PARTIAL' ? 'PARTIALLY PAID' : 'UNPAID'}</b></div>
        </div>
        <hr />
        {r.footer && <footer className="center">{r.footer}</footer>}
      </article>
    </div>
  );
}
