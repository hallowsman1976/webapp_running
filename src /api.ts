import { CONFIG } from './config';

export const callApi = async (action: string, data: any = {}) => {
  if (window.liff?.showLoading) window.liff.showLoading();
  try {
    const response = await fetch(CONFIG.GAS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, data }),
    });
    const result = await response.json();
    if (result.status === 'error') throw new Error(result.message);
    return result.data;
  } catch (error: any) {
    alert(`Error: ${error.message}`);
    throw error;
  } finally {
    if (window.liff?.hideLoading) window.liff.hideLoading();
  }
};
