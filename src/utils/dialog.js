// dialog.js — 自定义确认/提示弹窗（替代原生 confirm/alert，样式见 dialog.css）
// confirmDialog: 双按钮确认，resolve(true/false)
// alertDialog: 单按钮提示，resolve() 于关闭时

import { icons } from './icons.js';

function buildModal({ title, message, confirmText, cancelText, danger, isAlert }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'dlg-backdrop';

  const modal = document.createElement('div');
  modal.className = 'dlg-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', title);

  const body = document.createElement('div');
  body.className = 'dlg-modal__message';
  body.textContent = message; // 纯文本插入，防注入

  modal.innerHTML = `
    <div class="dlg-modal__header">
      <div class="dlg-modal__title">${title}</div>
      <button type="button" class="dlg-modal__close" data-dlg-close title="关闭" aria-label="关闭">${icons.close}</button>
    </div>
    <div class="dlg-modal__body"></div>
    <div class="dlg-modal__footer">
      ${isAlert ? '' : `<button type="button" class="dlg-btn dlg-btn--cancel" data-dlg-cancel>${cancelText}</button>`}
      <button type="button" class="dlg-btn ${danger ? 'dlg-btn--danger' : 'dlg-btn--primary'}" data-dlg-confirm>${confirmText}</button>
    </div>
  `;
  modal.querySelector('.dlg-modal__body').appendChild(body);
  backdrop.appendChild(modal);
  return { backdrop, modal };
}

export function confirmDialog({ title = '确认操作', message = '', confirmText = '确认', cancelText = '取消', danger = false }) {
  return new Promise((resolve) => {
    const { backdrop, modal } = buildModal({ title, message, confirmText, cancelText, danger, isAlert: false });
    document.body.appendChild(backdrop);

    const finish = (result) => {
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      resolve(result);
    };
    const onKey = (e) => { if (e.key === 'Escape') finish(false); };
    document.addEventListener('keydown', onKey);

    modal.querySelector('[data-dlg-close]').addEventListener('click', () => finish(false));
    modal.querySelector('[data-dlg-cancel]').addEventListener('click', () => finish(false));
    modal.querySelector('[data-dlg-confirm]').addEventListener('click', () => finish(true));
    setTimeout(() => modal.querySelector('[data-dlg-confirm]').focus(), 0);
  });
}

export function alertDialog({ title = '提示', message = '', confirmText = '知道了', danger = false }) {
  return new Promise((resolve) => {
    const { backdrop, modal } = buildModal({ title, message, confirmText, cancelText: '', danger, isAlert: true });
    document.body.appendChild(backdrop);

    const finish = () => {
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      resolve();
    };
    const onKey = (e) => { if (e.key === 'Escape') finish(); };
    document.addEventListener('keydown', onKey);

    modal.querySelector('[data-dlg-close]').addEventListener('click', finish);
    modal.querySelector('[data-dlg-confirm]').addEventListener('click', finish);
    setTimeout(() => modal.querySelector('[data-dlg-confirm]').focus(), 0);
  });
}
