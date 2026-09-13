let toastTimer = null;
const toastEl = document.getElementById('toast');

export function dismissToast() {
  clearTimeout(toastTimer);
  toastTimer = null;
  toastEl.classList.remove('show');
  toastEl.textContent = '';
}

export function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(dismissToast, Math.max(3200, Math.min(6500, msg.length * 48)));
}
