const REPO = 'DandanITman/OfficeWrite';
const FALLBACK_RELEASES = `https://github.com/${REPO}/releases/latest`;

async function loadLatestRelease() {
  const btnTop = document.getElementById('download-btn');
  const btnBottom = document.getElementById('download-btn-bottom');
  const meta = document.getElementById('download-meta');

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!res.ok) throw new Error('No release yet');

    const release = await res.json();
    const asset =
      release.assets?.find((a) => /\.exe$/i.test(a.name)) ??
      release.assets?.find((a) => /\.msi$/i.test(a.name));

    const href = asset?.browser_download_url ?? release.html_url;
    const label = asset
      ? `Download ${asset.name} (${prettySize(asset.size)})`
      : 'View latest release';

    [btnTop, btnBottom].forEach((btn) => {
      if (!btn) return;
      btn.href = href;
      if (btn === btnBottom) btn.textContent = label;
    });

    meta.textContent = asset
      ? `Latest: v${release.tag_name.replace(/^v/, '')} · Windows installer`
      : `Release ${release.tag_name}: open the Releases page to download`;
  } catch {
    [btnTop, btnBottom].forEach((btn) => {
      if (btn) btn.href = FALLBACK_RELEASES;
    });
    meta.textContent =
      'First release coming soon. Star the repo on GitHub to get notified, or build from source today.';
  }
}

function prettySize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

/**
 * The screenshot tour. Each tab swaps the image and its caption; the captions
 * live here rather than in the markup so the two cannot drift apart.
 */
const SHOTS = {
  home: 'Pick up where you left off, or start from a template.',
  editor: 'The Home tab: clipboard, font, paragraph, a live styles gallery, and find.',
  insert: 'Tables, pictures, shapes, links, headers and footers, symbols and emoji.',
  references: 'Contents, footnotes, citations and bibliography, captions and an index.',
  review: 'Spelling and grammar, comments, track changes, compare, accessibility.',
  mailings: 'A full mail merge: recipients, merge fields, rules, preview and finish.',
  navigation: 'The navigation pane searches the document and lists its headings.',
  dark: 'Dark mode, for writing at night.',
};

function setUpTour() {
  const tabs = Array.from(document.querySelectorAll('.tour-tabs button'));
  const image = document.getElementById('tour-image');
  const caption = document.getElementById('tour-caption');
  if (!tabs.length || !image || !caption) return;

  const show = (tab) => {
    const shot = tab.dataset.shot;
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    image.src = `shots/${shot}.png`;
    image.alt = `Officewrite: ${tab.textContent.trim()}`;
    caption.textContent = SHOTS[shot] ?? '';
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => show(tab));
    // A tablist owes arrow-key navigation, the same as the app's own ribbon.
    tab.addEventListener('keydown', (event) => {
      const index = tabs.indexOf(tab);
      const next =
        event.key === 'ArrowRight'
          ? (index + 1) % tabs.length
          : event.key === 'ArrowLeft'
            ? (index - 1 + tabs.length) % tabs.length
            : null;
      if (next === null) return;
      event.preventDefault();
      tabs[next].focus();
      show(tabs[next]);
    });
  });

  // Preload the rest so switching tabs does not flash an empty frame.
  Object.keys(SHOTS).forEach((shot) => {
    const img = new Image();
    img.src = `shots/${shot}.png`;
  });
}

loadLatestRelease();
setUpTour();
