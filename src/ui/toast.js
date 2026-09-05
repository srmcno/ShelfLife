let toastTimer = null;
const toastEl = document.getElementById('toast');

export function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.classList.remove('show'); toastEl.textContent = ''; }, Math.max(3200, Math.min(6500, msg.length * 48)));
}
