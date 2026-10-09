/* Helpers de interface: escape, formatacao, toast, modal e confirmacao. */
const UI = (() => {
  function esc(value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const fmt = {
    km(value) {
      if (value == null || value === '') return '-';
      return Number(value).toLocaleString('pt-BR');
    },
    date(iso) {
      if (!iso) return '-';
      return new Date(iso).toLocaleDateString('pt-BR');
    },
    time(iso) {
      if (!iso) return '-';
      return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    },
    dateTime(iso) {
      if (!iso) return '-';
      return fmt.date(iso) + ' ' + fmt.time(iso);
    },
    duration(minutes) {
      if (minutes == null) return '-';
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return h > 0 ? h + 'h ' + String(m).padStart(2, '0') + 'min' : m + 'min';
    },
    badge(value) {
      const slug = String(value || '').toLowerCase();
      return '<span class="badge ' + esc(slug) + '">' + esc(value) + '</span>';
    },
  };

  function toast(message, type) {
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.textContent = message;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  /** Abre um modal. onSubmit recebe (formData, helpers) e deve lancar Error para exibir o erro. */
  function modal({ title, body, confirmLabel = 'CONFIRMAR', confirmClass = '', onSubmit, onMount, wide }) {
    const root = document.getElementById('modal-root');
    root.innerHTML =
      '<div class="modal-backdrop">' +
        '<div class="modal"' + (wide ? ' style="max-width:720px"' : '') + '>' +
          '<header><h3>' + esc(title) + '</h3><button class="close" type="button" aria-label="Fechar">&times;</button></header>' +
          '<form><div class="body">' +
            '<div class="form-error" data-error hidden></div>' + body +
          '</div>' +
          '<div class="footer">' +
            '<button type="button" class="btn ghost" data-cancel>Cancelar</button>' +
            (onSubmit ? '<button type="submit" class="btn ' + confirmClass + '">' + esc(confirmLabel) + '</button>' : '') +
          '</div></form>' +
        '</div>' +
      '</div>';

    const backdrop = root.firstElementChild;
    const form = backdrop.querySelector('form');
    const errorBox = backdrop.querySelector('[data-error]');
    const submitBtn = form.querySelector('button[type="submit"]');

    function close() {
      root.innerHTML = '';
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    function showError(message) {
      errorBox.textContent = message;
      errorBox.hidden = !message;
    }

    backdrop.querySelector('.close').addEventListener('click', close);
    backdrop.querySelector('[data-cancel]').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

    if (onSubmit) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showError('');
        submitBtn.disabled = true;
        const data = Object.fromEntries(new FormData(form).entries());
        try {
          await onSubmit(data, { close, showError, form });
        } catch (err) {
          showError(err.message);
        } finally {
          submitBtn.disabled = false;
        }
      });
    }

    if (onMount) onMount({ form, close, showError });

    const firstInput = form.querySelector('select:not([disabled]), input:not([readonly]):not([type=hidden]), textarea');
    if (firstInput) firstInput.focus();

    return { close, showError, form };
  }

  /** Modal de confirmacao para operacoes importantes. */
  function confirm({ title, message, confirmLabel = 'CONFIRMAR', confirmClass = '', onConfirm }) {
    return modal({
      title,
      body: '<p style="margin:0">' + message + '</p>',
      confirmLabel,
      confirmClass,
      onSubmit: async (_data, helpers) => {
        await onConfirm();
        helpers.close();
      },
    });
  }

  function options(items, { value = 'id', label = 'name', selected, placeholder } = {}) {
    const head = placeholder ? '<option value="">' + esc(placeholder) + '</option>' : '';
    return head + items.map((item) => {
      const val = item[value];
      const text = typeof label === 'function' ? label(item) : item[label];
      const isSel = String(val) === String(selected) ? ' selected' : '';
      return '<option value="' + esc(val) + '"' + isSel + '>' + esc(text) + '</option>';
    }).join('');
  }

  function table({ columns, rows, renderRow, empty = 'Nenhum registro encontrado.' }) {
    if (!rows.length) return '<div class="table-wrap"><div class="empty">' + esc(empty) + '</div></div>';
    return '<div class="table-wrap"><table><thead><tr>' +
      columns.map((c) => '<th>' + esc(c) + '</th>').join('') +
      '</tr></thead><tbody>' +
      rows.map(renderRow).join('') +
      '</tbody></table></div>';
  }

  function vehicleLabel(v) {
    return v.code + ' - ' + (v.brand ? v.brand + ' ' : '') + v.model + ' (' + v.plate + ')';
  }

  return { esc, fmt, toast, modal, confirm, options, table, vehicleLabel };
})();
