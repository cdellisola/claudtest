// Reusable font dropdown with live previews + inline upload. Multiple instances
// can coexist (name tag uses one, interlock uses three).
import { fonts, importFontFile, removeUserFont } from './fonts';

export interface FontPicker {
  el: HTMLElement;
  getSelectedId(): string;
  refresh(): void;
  destroy(): void;
}

const registry = new Set<FontPicker>();
export function refreshAllPickers() {
  for (const p of registry) p.refresh();
}

export function createFontPicker(opts: {
  initialId?: string;
  preferName?: string;
  onChange: (id: string) => void;
}): FontPicker {
  let selectedId = opts.initialId ?? fonts[0]?.id ?? 'helvetiker';
  let userTouched = false;

  const el = document.createElement('div');
  el.className = 'dropdown';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'dropdown-trigger';
  const panel = document.createElement('div');
  panel.className = 'dropdown-panel hidden';
  const upload = document.createElement('input');
  upload.type = 'file';
  upload.accept = '.ttf,.otf';
  upload.style.display = 'none';
  el.append(trigger, panel, upload);

  upload.addEventListener('change', async (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const opt = await importFontFile(file);
    (ev.target as HTMLInputElement).value = '';
    if (opt) {
      userTouched = true;
      selectedId = opt.id;
      opts.onChange(selectedId);
    }
    refreshAllPickers();
  });

  const current = () => fonts.find((f) => f.id === selectedId) ?? fonts[0];

  function render() {
    // Auto-pick a preferred font once it has loaded (unless the user chose one).
    if (!userTouched && opts.preferName) {
      const pf = fonts.find((f) => f.name === opts.preferName);
      if (pf && pf.id !== selectedId) {
        selectedId = pf.id;
        queueMicrotask(() => opts.onChange(selectedId));
      }
    }

    const c = current();
    trigger.textContent = c ? c.name : '—';
    trigger.style.fontFamily = c ? c.cssFamily : 'inherit';

    panel.innerHTML = '';
    for (const f of fonts) {
      const item = document.createElement('div');
      item.className = 'font-item' + (f.id === selectedId ? ' selected' : '');
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = f.name;
      label.style.fontFamily = f.cssFamily;
      item.appendChild(label);

      if (f.user) {
        const rm = document.createElement('button');
        rm.className = 'remove';
        rm.type = 'button';
        rm.title = 'Rimuovi questo font';
        rm.textContent = '✕';
        rm.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          const wasSel = f.id === selectedId;
          await removeUserFont(f);
          if (wasSel) {
            selectedId = fonts[0]?.id ?? 'helvetiker';
            opts.onChange(selectedId);
          }
          refreshAllPickers();
        });
        item.appendChild(rm);
      } else if (f.id !== 'helvetiker') {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = 'OFL';
        item.appendChild(badge);
      }

      item.addEventListener('click', () => {
        userTouched = true;
        selectedId = f.id;
        panel.classList.add('hidden');
        render();
        opts.onChange(selectedId);
      });
      panel.appendChild(item);
    }

    const up = document.createElement('div');
    up.className = 'font-item font-upload';
    up.textContent = '＋ Carica un font .ttf/.otf';
    up.addEventListener('click', () => {
      panel.classList.add('hidden');
      upload.click();
    });
    panel.appendChild(up);
  }

  trigger.addEventListener('click', () => panel.classList.toggle('hidden'));
  const outside = (e: MouseEvent) => {
    if (!el.contains(e.target as Node)) panel.classList.add('hidden');
  };
  document.addEventListener('click', outside);

  render();

  const picker: FontPicker = {
    el,
    getSelectedId: () => selectedId,
    refresh: render,
    destroy: () => {
      registry.delete(picker);
      document.removeEventListener('click', outside);
      el.remove();
    },
  };
  registry.add(picker);
  return picker;
}
