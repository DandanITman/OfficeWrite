import type { Editor } from '@tiptap/react';
import { readabilityStats } from '@officewrite/core';

interface WordCountDialogProps {
  open: boolean;
  editor: Editor | null;
  pages: number;
  onClose: () => void;
}

/** Word count details. The View tab previously had no such command at all. */
export function WordCountDialog({ open, editor, pages, onClose }: WordCountDialogProps) {
  if (!open) return null;

  const text = editor?.getText() ?? '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charactersNoSpaces = text.replace(/\s/g, '').length;
  const paragraphs = editor
    ? editor.state.doc.content.content.filter((node) => node.type.name === 'paragraph' && node.textContent.trim())
        .length
    : 0;

  const lines = editor
    ? editor.state.doc.content.content.filter((node) => node.textContent.trim()).length
    : 0;
  const readability = readabilityStats(text);

  // Explicit keys: deriving them from the label collided the two character
  // rows onto one id.
  const rows: Array<{ key: string; label: string; value: number }> = [
    { key: 'pages', label: 'Pages', value: pages },
    { key: 'words', label: 'Words', value: words },
    { key: 'characters', label: 'Characters (with spaces)', value: text.length },
    { key: 'characters-no-spaces', label: 'Characters (no spaces)', value: charactersNoSpaces },
    { key: 'paragraphs', label: 'Paragraphs', value: paragraphs },
    { key: 'lines', label: 'Lines', value: lines },
    { key: 'sentences', label: 'Sentences', value: readability.sentences },
  ];

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} data-testid="word-count-dialog">
        <h2>Word Count</h2>
        <table className="word-count-table">
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                <td data-testid={`word-count-${row.key}`}>{row.value.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* A word processor shows readability alongside the counts; the same statistics. */}
        <h3>Readability</h3>
        <table className="word-count-table">
          <tbody>
            <tr>
              <th scope="row">Flesch Reading Ease</th>
              <td data-testid="word-count-reading-ease">{readability.readingEase}</td>
            </tr>
            <tr>
              <th scope="row">Flesch–Kincaid Grade Level</th>
              <td data-testid="word-count-grade-level">{readability.gradeLevel}</td>
            </tr>
          </tbody>
        </table>
        <div className="dialog-actions">
          <button className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
