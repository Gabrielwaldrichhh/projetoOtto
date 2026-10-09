/* Cliente da API REST + sessao (token no localStorage). */
const Api = (() => {
  const TOKEN_KEY = 'portaria_token';
  const USER_KEY = 'portaria_user';

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; }
  }

  function setSession(token, user) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) { /* modo privado: sessao vale so para esta pagina */ }
  }

  function clearSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) { /* ignore */ }
  }

  async function request(method, path, body) {
    const token = getToken();
    const res = await fetch('/api' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && path !== '/auth/login') {
      clearSession();
      window.location.reload();
      throw new Error('Sessao expirada.');
    }

    const text = await res.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = null; }
    }
    if (!res.ok) throw new Error((data && data.error) || 'Erro ao comunicar com o servidor.');
    return data;
  }

  function qs(params) {
    const search = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== '' && v != null) search.append(k, v);
    });
    const str = search.toString();
    return str ? '?' + str : '';
  }

  return {
    getToken, getUser, setSession, clearSession, qs,
    get: (p) => request('GET', p),
    post: (p, b) => request('POST', p, b),
    put: (p, b) => request('PUT', p, b),
    patch: (p, b) => request('PATCH', p, b),

    login: (username, password) => request('POST', '/auth/login', { username, password }),
    me: () => request('GET', '/auth/me'),

    // Download autenticado do CSV (Authorization nao vai em um link simples).
    async downloadCsv(params) {
      const res = await fetch('/api/reports/export.csv' + qs(params), {
        headers: { Authorization: 'Bearer ' + getToken() },
      });
      if (!res.ok) throw new Error('Falha ao exportar o CSV.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'movimentacoes-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  };
})();
