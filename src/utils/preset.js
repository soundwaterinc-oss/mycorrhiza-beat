// URL parameter preset save/load (Base64 JSON)
export function savePreset(state) {
  try {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    const url = new URL(window.location.href);
    url.searchParams.set('p', encoded);
    window.history.replaceState({}, '', url.toString());
  } catch (e) {
    console.warn('[preset] save failed', e);
  }
}

export function loadPreset() {
  try {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('p');
    if (!p) return null;
    return JSON.parse(decodeURIComponent(escape(atob(p))));
  } catch {
    return null;
  }
}
