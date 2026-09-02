type PromptRequest = {
  message: string;
  defaultValue: string;
  resolve: (value: string | null) => void;
};

type AlertRequest = {
  message: string;
  resolve: () => void;
};

type ConfirmRequest = {
  message: string;
  resolve: (value: boolean) => void;
};

type PromptHost = {
  prompt: (request: PromptRequest) => void;
  alert: (request: AlertRequest) => void;
  confirm: (request: ConfirmRequest) => void;
};

let host: PromptHost | null = null;

export function registerUiPromptHost(next: PromptHost | null) {
  host = next;
}

/*
 * Note: there is deliberately no test-mode branch here. This used to fall back
 * to window.prompt/alert/confirm whenever `data-test-mode` was set, so the e2e
 * suite drove native dialogs while users only ever saw UiPromptHost - the two
 * were never exercised together.
 */

export function uiPrompt(message: string, defaultValue = ''): Promise<string | null> {
  if (!host) {
    return Promise.resolve(window.prompt(message, defaultValue));
  }
  return new Promise((resolve) => {
    host!.prompt({ message, defaultValue, resolve });
  });
}

export function uiAlert(message: string): Promise<void> {
  if (!host) {
    window.alert(message);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    host!.alert({ message, resolve });
  });
}

export function uiConfirm(message: string): Promise<boolean> {
  if (!host) {
    return Promise.resolve(window.confirm(message));
  }
  return new Promise((resolve) => {
    host!.confirm({ message, resolve });
  });
}

export type { PromptRequest, AlertRequest, ConfirmRequest };
