const API_BASE = '/api';

async function request(url, options = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || `请求失败 (${response.status})`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export function getStatistics() {
  return request('/statistics');
}

export function getMedicines(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/medicines${query ? `?${query}` : ''}`);
}

export function getMedicineLocations() {
  return request('/medicines/locations');
}

export function getMedicine(id) {
  return request(`/medicines/${id}`);
}

export function addMedicine(data) {
  return request('/medicines', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateMedicine(id, data) {
  return request(`/medicines/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteMedicine(id) {
  return request(`/medicines/${id}`, {
    method: 'DELETE',
  });
}

export function stockMedicine(id, quantity, note = '') {
  return request(`/medicines/${id}/stock`, {
    method: 'POST',
    body: JSON.stringify({ quantity, note }),
  });
}

export function takeMedicine(id, quantity, note = '') {
  return request(`/medicines/${id}/take`, {
    method: 'POST',
    body: JSON.stringify({ quantity, note }),
  });
}

export function discardMedicine(id, quantity, note = '') {
  return request(`/medicines/${id}/discard`, {
    method: 'POST',
    body: JSON.stringify({ quantity, note }),
  });
}

export function getTransactions(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/transactions${query ? `?${query}` : ''}`);
}

export function importPreview(file) {
  const formData = new FormData();
  formData.append('file', file);
  return fetch(`${API_BASE}/import/preview`, {
    method: 'POST',
    body: formData,
  }).then(async (response) => {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '请求失败' }));
      throw new Error(error.error || `请求失败 (${response.status})`);
    }
    return response.json();
  });
}

export function importConfirm(file) {
  const formData = new FormData();
  formData.append('file', file);
  return fetch(`${API_BASE}/import/confirm`, {
    method: 'POST',
    body: formData,
  }).then(async (response) => {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '请求失败' }));
      throw new Error(error.error || `请求失败 (${response.status})`);
    }
    return response.json();
  });
}

export function exportCSV() {
  return fetch(`${API_BASE}/export`).then(async (response) => {
    if (!response.ok) {
      throw new Error('导出失败');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medicines.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  });
}

export function discardExpired(id, note = '') {
  return request(`/expired/${id}/discard`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

export function getPlans(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/plans${query ? `?${query}` : ''}`);
}

export function getPlan(id) {
  return request(`/plans/${id}`);
}

export function getTodayPlans() {
  return request('/plans/today');
}

export function addPlan(data) {
  return request('/plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function executePlan(id, action, scheduledDate, scheduledTime, note = '') {
  return request(`/plans/${id}/execute`, {
    method: 'POST',
    body: JSON.stringify({ action, scheduledDate, scheduledTime, note }),
  });
}

export function disablePlan(id, note = '') {
  return request(`/plans/${id}/disable`, {
    method: 'PUT',
    body: JSON.stringify({ note }),
  });
}

export function getPlanLogs(id) {
  return request(`/plans/${id}/logs`);
}
