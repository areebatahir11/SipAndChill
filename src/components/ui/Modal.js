'use client';
import Button from './Button';

export default function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-10 grid place-items-center bg-night/55 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-[500px] overflow-auto rounded-[18px] bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[17px] font-semibold">{title}</h3>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        {children}
      </div>
    </div>
  );
}
