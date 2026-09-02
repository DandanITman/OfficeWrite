import { useEffect, useRef, useState } from 'react';
import {
  registerUiPromptHost,
  type AlertRequest,
  type ConfirmRequest,
  type PromptRequest,
} from '../utils/uiPrompt';

export function UiPromptHost() {
  const [promptRequest, setPromptRequest] = useState<PromptRequest | null>(null);
  const [alertRequest, setAlertRequest] = useState<AlertRequest | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    registerUiPromptHost({
      prompt: (request) => {
        setAlertRequest(null);
        setConfirmRequest(null);
        setValue(request.defaultValue);
        setPromptRequest(request);
      },
      alert: (request) => {
        setPromptRequest(null);
        setConfirmRequest(null);
        setAlertRequest(request);
      },
      confirm: (request) => {
        setPromptRequest(null);
        setAlertRequest(null);
        setConfirmRequest(request);
      },
    });
    return () => registerUiPromptHost(null);
  }, []);

  useEffect(() => {
    if (promptRequest) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [promptRequest]);

  const closePrompt = (result: string | null) => {
    promptRequest?.resolve(result);
    setPromptRequest(null);
  };

  const closeAlert = () => {
    alertRequest?.resolve();
    setAlertRequest(null);
  };

  const closeConfirm = (result: boolean) => {
    confirmRequest?.resolve(result);
    setConfirmRequest(null);
  };

  if (promptRequest) {
    return (
      <div className="backdrop ui-prompt-backdrop" onClick={() => closePrompt(null)}>
        <div
          className="dialog panel-card ui-prompt-dialog"
          role="dialog"
          aria-modal="true"
          data-testid="ui-prompt"
          aria-label={promptRequest.message}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="ui-prompt-message">{promptRequest.message}</p>
          <input
            ref={inputRef}
            data-testid="ui-prompt-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') closePrompt(value);
              if (e.key === 'Escape') closePrompt(null);
            }}
          />
          <div className="dialog-actions">
            <button type="button" className="icon-btn" onClick={() => closePrompt(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="icon-btn primary"
              data-testid="ui-prompt-ok"
              onClick={() => closePrompt(value)}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (alertRequest) {
    return (
      <div className="backdrop ui-prompt-backdrop" onClick={closeAlert}>
        <div
          className="dialog panel-card ui-prompt-dialog"
          role="alertdialog"
          data-testid="ui-alert"
          aria-modal="true"
          aria-label={alertRequest.message}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="ui-prompt-message">{alertRequest.message}</p>
          <div className="dialog-actions">
            <button
              type="button"
              className="icon-btn primary"
              data-testid="ui-alert-ok"
              onClick={closeAlert}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (confirmRequest) {
    return (
      <div className="backdrop ui-prompt-backdrop" onClick={() => closeConfirm(false)}>
        <div
          className="dialog panel-card ui-prompt-dialog"
          role="alertdialog"
          data-testid="ui-confirm"
          aria-modal="true"
          aria-label={confirmRequest.message}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="ui-prompt-message">{confirmRequest.message}</p>
          <div className="dialog-actions">
            <button
              type="button"
              className="icon-btn"
              data-testid="ui-confirm-cancel"
              onClick={() => closeConfirm(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="icon-btn primary"
              data-testid="ui-confirm-ok"
              onClick={() => closeConfirm(true)}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
