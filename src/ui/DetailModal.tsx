import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { DetailPanel } from './DetailPanel';

export function DetailModal() {
  const selection = useAppStore((s) => s.selection);
  const clearSelection = useAppStore((s) => s.clearSelection);

  const open = selection != null;

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="detail-modal-overlay"
      role="presentation"
      onClick={() => clearSelection()}
    >
      <div
        className="detail-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Details"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="detail-modal-head">
          <button
            type="button"
            className="btn"
            onClick={() => clearSelection()}
            title="Close (Esc)"
            aria-label="Close details"
          >
            ×
          </button>
        </div>
        <div className="detail-modal-body">
          <DetailPanel />
        </div>
      </div>
    </div>
  );
}
