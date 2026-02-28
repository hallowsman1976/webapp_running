// src/components/modal.ts

export const Modal = {
  confirm(message: string, detail?: string): Promise<boolean> {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = `
        fixed inset-0 bg-black/50 backdrop-blur-sm z-[9990]
        flex items-end sm:items-center justify-center p-4 animate-fade-in`;

      overlay.innerHTML = `
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 animate-slide-up shadow-2xl">
          <h3 class="text-lg font-semibold text-runner-primary mb-2">${message}</h3>
          ${detail ? `<p class="text-sm text-gray-500 mb-6">${detail}</p>` : '<div class="mb-6"></div>'}
          <div class="flex gap-3">
            <button id="modal-cancel"
              class="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600
                     font-medium text-sm active:scale-95 transition-transform">
              ยกเลิก
            </button>
            <button id="modal-confirm"
              class="flex-1 py-3 rounded-xl bg-runner-secondary text-white
                     font-semibold text-sm active:scale-95 transition-transform">
              ยืนยัน
            </button>
          </div>
        </div>`;

      document.body.appendChild(overlay);

      const cleanup = (result: boolean) => {
        overlay.remove();
        resolve(result);
      };

      overlay.querySelector('#modal-confirm')?.addEventListener('click', () => cleanup(true));
      overlay.querySelector('#modal-cancel')?.addEventListener('click',  () => cleanup(false));
      overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); });
    });
  },

  alert(message: string, detail?: string): Promise<void> {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = `
        fixed inset-0 bg-black/50 backdrop-blur-sm z-[9990]
        flex items-end sm:items-center justify-center p-4 animate-fade-in`;

      overlay.innerHTML = `
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 animate-slide-up shadow-2xl">
          <h3 class="text-lg font-semibold text-runner-primary mb-2">${message}</h3>
          ${detail ? `<p class="text-sm text-gray-500 mb-6">${detail}</p>` : '<div class="mb-6"></div>'}
          <button id="modal-ok"
            class="w-full py-3 rounded-xl bg-runner-primary text-white
                   font-semibold text-sm active:scale-95 transition-transform">
            ตกลง
          </button>
        </div>`;

      document.body.appendChild(overlay);
      overlay.querySelector('#modal-ok')?.addEventListener('click', () => {
        overlay.remove();
        resolve();
      });
    });
  }
};
