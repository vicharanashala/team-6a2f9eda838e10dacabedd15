const getApiUrl = () => {
  if (typeof window === 'undefined') {
    return (process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_URL)
      ? `https://${process.env.VERCEL_URL || 'prashnasarathi.vercel.app'}/_/backend/api`
      : (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')
          ? process.env.NEXT_PUBLIC_API_URL
          : 'http://localhost:5000/api');
  }

  const origin = window.location.origin;
  if (origin.startsWith('tauri://') || origin.startsWith('file:') || origin.startsWith('capacitor://')) {
    return 'https://prashnasarathi.vercel.app/api';
  }

  return '/api';
};

const API_URL = getApiUrl();

class ApiClient {
  constructor() {
    this.baseUrl = API_URL;
  }

  getToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  }

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = { ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const isFormData = options.body instanceof FormData;
    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json();

    if (!res.ok) {
      let errMsg = data.reason || data.error || data.message;
      if (!errMsg) {
        if (data.suspended) {
          const minutes = Math.ceil((data.retryAfter - Date.now()) / 60000);
          errMsg = `Your account is temporarily suspended. Please try again in ${minutes > 0 ? minutes : 1} minute(s).`;
        } else if (data.blocked) {
          errMsg = 'Your account has been blocked due to multiple violations of community guidelines.';
        } else if (data.errors && Array.isArray(data.errors)) {
          errMsg = data.errors.map(err => err.msg).join(', ');
        } else {
          errMsg = 'Request failed';
        }
      }
      const error = new Error(errMsg);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  get(endpoint, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    const qs = query.toString();
    return this.request(`${endpoint}${qs ? `?${qs}` : ''}`);
  }

  post(endpoint, body) {
    const isFormData = body instanceof FormData;
    return this.request(endpoint, { 
      method: 'POST', 
      body: isFormData ? body : JSON.stringify(body) 
    });
  }

  put(endpoint, body) {
    const isFormData = body instanceof FormData;
    return this.request(endpoint, { 
      method: 'PUT', 
      body: isFormData ? body : JSON.stringify(body) 
    });
  }

  patch(endpoint, body) {
    const isFormData = body instanceof FormData;
    return this.request(endpoint, { 
      method: 'PATCH', 
      body: isFormData ? body : JSON.stringify(body) 
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

const api = new ApiClient();
export default api;
