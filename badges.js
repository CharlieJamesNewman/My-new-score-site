(() => {
  const cache = new Map();
  const aliases = {
    'Forest': 'Nottingham Forest',
    'Dortmund': 'Borussia Dortmund',
    'Leverkusen': 'Bayer Leverkusen',
    'PSG': 'Paris Saint-Germain',
    'Atletico': 'Atletico Madrid',
    'Atlético': 'Atletico Madrid'
  };

  const style = document.createElement('style');
  style.textContent = '.crest{position:relative;overflow:hidden}.crest img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 1px 2px rgba(0,0,0,.25));}';
  document.head.appendChild(style);

  function teamName(crest) {
    const parent = crest.parentElement;
    return (parent.textContent || '').replace(crest.textContent || '', '').trim();
  }

  async function badgeUrl(team) {
    const name = aliases[team] || team;
    if (cache.has(name)) return cache.get(name);
    const request = fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(name)}`)
      .then(response => response.ok ? response.json() : null)
      .then(payload => payload?.teams?.[0]?.strBadge || null)
      .catch(() => null);
    cache.set(name, request);
    return request;
  }

  function removeWhiteMatte(image) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const [red, green, blue] = [pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]];
      const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
      if (red > 238 && green > 238 && blue > 238) pixels.data[i + 3] = 0;
      else if (red > 218 && green > 218 && blue > 218 && spread < 10) pixels.data[i + 3] = 80;
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL('image/png');
  }

  function fallbackBadge(team) {
    const initials = team.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
    let seed = 0;
    for (const character of team) seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
    const hues = [5, 18, 42, 118, 190, 218, 262, 312];
    const hue = hues[seed % hues.length];
    const accent = hues[(seed >>> 3) % hues.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="hsl(${hue} 72% 44%)" d="M50 4 91 19v29c0 24-16 39-41 49C25 87 9 72 9 48V19z"/><path fill="hsl(${accent} 82% 57%)" d="M15 24 50 11l35 13v12L50 24 15 36z"/><circle cx="50" cy="67" r="18" fill="#ffffff" fill-opacity=".18"/><text x="50" y="73" fill="white" font-family="Arial,sans-serif" font-size="25" font-weight="700" text-anchor="middle">${initials}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  async function decorate() {
    for (const crest of document.querySelectorAll('.crest:not([data-badge-ready])')) {
      crest.dataset.badgeReady = 'true';
      const team = teamName(crest);
      if (!team) continue;
      const url = await badgeUrl(team);
      if (!crest.isConnected) continue;
      const image = new Image();
      image.alt = `${team} badge`;
      if (!url) {
        image.src = fallbackBadge(team);
        crest.appendChild(image);
        continue;
      }
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        try { image.onload = null; image.src = removeWhiteMatte(image); } catch (_) { /* retain original badge if the host blocks pixel access */ }
        crest.appendChild(image);
      };
      image.onerror = () => {
        image.onerror = null;
        image.src = fallbackBadge(team);
        crest.appendChild(image);
      };
      image.src = url;
    }
  }

  new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });
  decorate();
})();
