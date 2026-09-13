// WebView Shield — prevents external browser opening on Android Capacitor.
// Intercepts window.open, target=_blank, and form target=_blank.
(function () {
  if (!window.Capacitor || (typeof window.Capacitor.isNativePlatform !== 'function' && !window.Capacitor.isNative)) return;
  const isNative = typeof window.Capacitor.isNativePlatform === 'function'
    ? window.Capacitor.isNativePlatform()
    : !!window.Capacitor.isNative;
  if (!isNative) return;

  const origin = window.location.origin;

  // Override window.open
  const origOpen = window.open;
  window.open = function (url, target, features) {
    if (!url) return null;
    const abs = url.startsWith('http') ? url : new URL(url, origin).href;
    if (abs.startsWith(origin)) {
      window.location.href = abs;
    }
    return null;
  };

  // Intercept target=_blank clicks
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[target="_blank"]');
    if (a && a.href) {
      e.preventDefault();
      e.stopPropagation();
      const abs = a.href.startsWith('http') ? a.href : new URL(a.href, origin).href;
      if (abs.startsWith(origin)) {
        window.location.href = abs;
      }
    }
  }, true);

  // Intercept form target=_blank
  document.addEventListener('submit', function (e) {
    const form = e.target;
    if (form && form.target === '_blank') {
      e.preventDefault();
      form.target = '_self';
      form.submit();
    }
  }, true);
})();
