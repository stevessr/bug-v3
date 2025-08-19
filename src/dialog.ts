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
