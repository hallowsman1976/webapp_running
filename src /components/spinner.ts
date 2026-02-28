// src/components/spinner.ts

export function renderSpinner(text = 'กำลังโหลด...'): string {
  return `
    <div class="fixed inset-0 flex flex-col items-center justify-center
                bg-white/80 backdrop-blur-sm z-50 gap-3">
      <div class="w-12 h-12 rounded-full border-4 border-gray-200
                  border-t-line-green animate-spin"></div>
      <p class="text-sm text-gray-500">${text}</p>
    </div>`;
}

export function renderInlineSpinner(): string {
  return `<div class="flex items-center justify-center py-12">
    <div class="w-10 h-10 rounded-full border-4 border-gray-200
                border-t-runner-secondary animate-spin"></div>
  </div>`;
}

export function showPageLoader(text = 'กำลังโหลด...'): void {
  const app = document.getElementById('app');
  if (app) app.innerHTML = renderSpinner(text);
}
