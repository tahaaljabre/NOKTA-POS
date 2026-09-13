// Capacitor detection helper — works across Capacitor 3–8+.
// Provides: isCapacitorNative(), requestStoragePermission(), getServerUrl(), setServerUrl()
const CapDetect = (() => {
  function isCapacitorNative() {
    if (!window.Capacitor) return false;
    if (typeof window.Capacitor.isNativePlatform === 'function') return window.Capacitor.isNativePlatform();
    return !!window.Capacitor.isNative;
  }

  function getServerUrl() {
    return localStorage.getItem('nokta_server_url') || '';
  }

  function setServerUrl(url) {
    if (url && url.endsWith('/')) url = url.slice(0, -1);
    localStorage.setItem('nokta_server_url', url);
  }

  function clearServerUrl() {
    localStorage.removeItem('nokta_server_url');
  }

  async function requestStoragePermission() {
    if (!isCapacitorNative()) return true;
    try {
      const perm = await Capacitor.Plugins.Permissions.requestPermissions({ permissions: ['storage'] });
      return perm?.storage === 'granted';
    } catch {
      return false;
    }
  }

  return { isCapacitorNative, getServerUrl, setServerUrl, clearServerUrl, requestStoragePermission };
})();

if (typeof module !== 'undefined') module.exports = CapDetect;
