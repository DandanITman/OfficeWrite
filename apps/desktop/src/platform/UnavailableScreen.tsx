/**
 * Shown instead of the editor when the Electron bridge is missing. Without this
 * the first mount effect calls into `window.officewrite`, throws, and React
 * unmounts the tree - leaving a blank white window with no explanation.
 */
export function UnavailableScreen() {
  return (
    <div className="platform-unavailable" role="alert">
      <h1>Officewrite needs the desktop app</h1>
      <p>
        This page is running without the Officewrite desktop bridge, so opening, saving,
        printing and spell check are unavailable.
      </p>
      <p>
        Start the app with <code>npm run dev</code>, or install the Windows build, rather
        than opening the page directly in a browser.
      </p>
    </div>
  );
}
