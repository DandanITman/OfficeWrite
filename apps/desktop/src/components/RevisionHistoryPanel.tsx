import type { DocumentRevision } from '@officewrite/core';

interface RevisionHistoryPanelProps {
  revisions: DocumentRevision[];
  onRestore: (id: string) => void;
  onClose: () => void;
}

export function RevisionHistoryPanel({ revisions, onRestore, onClose }: RevisionHistoryPanelProps) {
  return (
    <div>
      <h2>Version History</h2>
      <p className="muted">Local snapshots saved when you save the document.</p>
      {revisions.length === 0 ? (
        <p className="muted">No saved versions yet. Save the document to create a snapshot.</p>
      ) : (
        <ul className="revision-list">
          {revisions.map((rev) => (
            <li key={rev.id} className="revision-item panel-card">
              <div>
                <strong>{rev.label}</strong>
                <div className="muted">{new Date(rev.timestamp).toLocaleString()}</div>
              </div>
              <button className="icon-btn" onClick={() => onRestore(rev.id)}>
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="icon-btn" onClick={onClose} style={{ marginTop: 16 }}>
        Close
      </button>
    </div>
  );
}
