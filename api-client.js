(function () {
  const DEFAULT_API_URL = 'https://wzcrghqftwwsszwfgxzj.supabase.co/functions/v1/nst-api';
  const API_URL = window.NST_API_URL || DEFAULT_API_URL;
  const DEVICE_SESSION_KEY = 'nst_device_session';

  function wantsDeviceRemember() {
    const checkbox = document.getElementById('rememberCredentials') || document.getElementById('rememberLogin');
    return Boolean(checkbox && checkbox.checked);
  }

  function readDeviceSession() {
    try {
      return JSON.parse(localStorage.getItem(DEVICE_SESSION_KEY) || 'null');
    } catch (error) {
      localStorage.removeItem(DEVICE_SESSION_KEY);
      return null;
    }
  }

  function saveDeviceSessionFromSessionStorage() {
    const token = sessionStorage.getItem('nst_token');
    const user = sessionStorage.getItem('nst_user');
    if (token && user && wantsDeviceRemember()) {
      localStorage.setItem(DEVICE_SESSION_KEY, JSON.stringify({
        token,
        user,
        savedAt: new Date().toISOString()
      }));
    }
  }

  function clearDeviceSession() {
    localStorage.removeItem(DEVICE_SESSION_KEY);
  }

  const remembered = readDeviceSession();
  if (remembered && remembered.token && remembered.user && !sessionStorage.getItem('nst_token')) {
    sessionStorage.setItem('nst_token', remembered.token);
    sessionStorage.setItem('nst_user', remembered.user);
  }

  const rawSetItem = sessionStorage.setItem.bind(sessionStorage);
  const rawRemoveItem = sessionStorage.removeItem.bind(sessionStorage);
  const rawClear = sessionStorage.clear.bind(sessionStorage);

  sessionStorage.setItem = function (key, value) {
    rawSetItem(key, value);
    if (key === 'nst_token' || key === 'nst_user') saveDeviceSessionFromSessionStorage();
  };

  sessionStorage.removeItem = function (key) {
    rawRemoveItem(key);
    if (key === 'nst_token' || key === 'nst_user') clearDeviceSession();
  };

  sessionStorage.clear = function () {
    rawClear();
    clearDeviceSession();
  };

  function makeRunner(successHandler, failureHandler) {
    return new Proxy(function () {}, {
      get(_target, prop) {
        if (prop === 'withSuccessHandler') {
          return (handler) => makeRunner(handler, failureHandler);
        }
        if (prop === 'withFailureHandler') {
          return (handler) => makeRunner(successHandler, handler);
        }
        if (prop === 'then') return undefined;
        return async (...args) => {
          try {
            const response = await fetch(API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: String(prop), args })
            });
            const text = await response.text();
            let result;
            try {
              result = text ? JSON.parse(text) : {};
            } catch (error) {
              const preview = text ? text.slice(0, 80).replace(/\s+/g, ' ') : '';
              throw new Error(`API did not return JSON from ${API_URL}. ${preview}`);
            }
            if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);
            if (successHandler) successHandler(result);
            return result;
          } catch (error) {
            if (failureHandler) failureHandler(error);
            else throw error;
          }
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = makeRunner();
})();
