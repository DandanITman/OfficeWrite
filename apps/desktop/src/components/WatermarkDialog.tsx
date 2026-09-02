import type { Watermark } from '@officewrite/core';

interface WatermarkDialogProps {
  open: boolean;
  watermark: Watermark;
  onChange: (watermark: Watermark) => void;
  onClose: () => void;
}

export function WatermarkDialog({ open, watermark, onChange, onClose }: WatermarkDialogProps) {
  if (!open) return null;

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="dialog panel-card" onClick={(e) => e.stopPropagation()}>
        <h2>Watermark</h2>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={watermark.enabled}
            onChange={(e) => onChange({ ...watermark, enabled: e.target.checked })}
          />
          Show watermark
        </label>
        <label>
          Watermark text
          <input
            value={watermark.text}
            onChange={(e) => onChange({ ...watermark, text: e.target.value })}
            placeholder="DRAFT, CONFIDENTIAL, etc."
          />
        </label>
        <label>
          Opacity ({Math.round(watermark.opacity * 100)}%)
          <input
            type="range"
            min={0.05}
            max={0.4}
            step={0.01}
            value={watermark.opacity}
            onChange={(e) => onChange({ ...watermark, opacity: Number(e.target.value) })}
          />
        </label>
        <div className="dialog-actions">
          <button className="icon-btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
