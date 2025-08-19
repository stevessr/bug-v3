// Lightweight native dialog helpers using HTMLDialogElement
export function alertDialog(message: string) {
  return new Promise<void>((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `
      <div style="padding:16px;max-width:420px;">\
        <div style=\"margin-bottom:12px;white-space:pre-wrap;\">${String(message)}</div>\
        <div style=\"text-align:right;\">\
          <button id=\"ok\">确定</button>\
        </div>\
      </div>`;
    document.body.appendChild(dlg);
    const ok = dlg.querySelector('#ok') as HTMLButtonElement;
    ok.addEventListener('click', () => {
      dlg.close();
    });
    dlg.addEventListener('close', () => {
      dlg.remove();
      resolve();
    });
    try { dlg.showModal(); } catch (e) { /* fallback: alert */ alert(message); dlg.remove(); resolve(); }
  });
}

export function confirmDialog(message: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `
      <div style="padding:16px;max-width:420px;">\
        <div style=\"margin-bottom:12px;white-space:pre-wrap;\">${String(message)}</div>\
        <div style=\"text-align:right;\">\
          <button id=\"cancel\">取消</button>\
          <button id=\"ok\" style=\"margin-left:8px;\">确定</button>\
        </div>\
      </div>`;
    document.body.appendChild(dlg);
    const ok = dlg.querySelector('#ok') as HTMLButtonElement;
    const cancel = dlg.querySelector('#cancel') as HTMLButtonElement;
    ok.addEventListener('click', () => dlg.close('ok' as any));
    cancel.addEventListener('click', () => dlg.close('cancel' as any));
    dlg.addEventListener('close', () => {
      const returnValue = (dlg as any).returnValue;
      dlg.remove();
      resolve(returnValue === 'ok');
    });
    try { dlg.showModal(); } catch (e) { /* fallback */ const r = confirm(message); dlg.remove(); resolve(r); }
  });
}

export function promptDialog(message: string, defaultValue = ''): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `
      <div style="padding:12px;max-width:520px;">\
        <div style=\"margin-bottom:12px;white-space:pre-wrap;\">${String(message)}</div>\
        <div style=\"margin-bottom:12px;\">\
          <input id=\"input\" style=\"width:100%;padding:6px;box-sizing:border-box;\" value=\"${String(defaultValue).replace(/\"/g, '&quot;')}\" />\
        </div>\
        <div style=\"text-align:right;\">\
          <button id=\"cancel\">取消</button>\
          <button id=\"ok\" style=\"margin-left:8px;\">确定</button>\
        </div>\
      </div>`;
    document.body.appendChild(dlg);
    const ok = dlg.querySelector('#ok') as HTMLButtonElement;
    const cancel = dlg.querySelector('#cancel') as HTMLButtonElement;
    const input = dlg.querySelector('#input') as HTMLInputElement;
    ok.addEventListener('click', () => dlg.close('ok' as any));
    cancel.addEventListener('click', () => dlg.close('cancel' as any));
    dlg.addEventListener('close', () => {
      const returnValue = (dlg as any).returnValue;
      const val = input.value;
      dlg.remove();
      resolve(returnValue === 'ok' ? val : null);
    });
    try { dlg.showModal(); input.focus(); input.select(); } catch (e) { /* fallback */ const r = prompt(message, defaultValue); dlg.remove(); resolve(r); }
  });
}

export function editEmojiDialog(defaultName = '', defaultUrl = ''): Promise<{ name: string; url: string } | null> {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `
      <div style="padding:12px;max-width:520px;">
        <div style="margin-bottom:8px;font-weight:600;">编辑表情</div>
        <div style="margin-bottom:8px;">
          <label style="display:block;font-size:12px;margin-bottom:4px;">名称</label>
          <input id="name" style="width:100%;padding:6px;box-sizing:border-box;" value="${String(defaultName).replace(/"/g, '&quot;')}" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:12px;margin-bottom:4px;">URL</label>
          <input id="url" style="width:100%;padding:6px;box-sizing:border-box;" value="${String(defaultUrl).replace(/"/g, '&quot;')}" />
        </div>
        <div style="text-align:right;">
          <button id="cancel">取消</button>
          <button id="ok" style="margin-left:8px;">确定</button>
        </div>
      </div>`;
    document.body.appendChild(dlg);
    const ok = dlg.querySelector('#ok') as HTMLButtonElement;
    const cancel = dlg.querySelector('#cancel') as HTMLButtonElement;
    const nameInput = dlg.querySelector('#name') as HTMLInputElement;
    const urlInput = dlg.querySelector('#url') as HTMLInputElement;
    ok.addEventListener('click', () => dlg.close('ok' as any));
    cancel.addEventListener('click', () => dlg.close('cancel' as any));
    dlg.addEventListener('close', () => {
      const returnValue = (dlg as any).returnValue;
      const name = nameInput.value;
      const url = urlInput.value;
      dlg.remove();
      resolve(returnValue === 'ok' ? { name, url } : null);
    });
    try {
      dlg.showModal();
      nameInput.focus();
      nameInput.select();
    } catch (e) {
      /* fallback to sequential prompts (handling nulls) */
      const n = prompt('Name', defaultName);
      if (n === null) {
        dlg.remove();
        resolve(null);
        return;
      }
      const u = prompt('URL', defaultUrl);
      // u may be null — coerce to empty string in that case
      dlg.remove();
      resolve({ name: n, url: u === null ? '' : u });
    }
  });
}
