/**
 * API Service
 * Centralized API communication
 */

export default class ApiService {
  constructor() {
    this.baseURL = '/api';
    this.token = localStorage.getItem('token');
  }

  /**
   * Set authentication token
   */
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  /**
   * Get headers for requests
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Make API request
   */
  async request(method, endpoint, data = null) {
    const url = `${this.baseURL}${endpoint}`;
    const options = {
      method,
      headers: this.getHeaders(),
    };

    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Convenience methods
  get(endpoint) {
    return this.request('GET', endpoint);
  }

  post(endpoint, data) {
    return this.request('POST', endpoint, data);
  }

  put(endpoint, data) {
    return this.request('PUT', endpoint, data);
  }

  patch(endpoint, data) {
    return this.request('PATCH', endpoint, data);
  }

  delete(endpoint) {
    return this.request('DELETE', endpoint);
  }

  // Auth endpoints
  async login(username, password) {
    const response = await this.post('/login', { username, password });
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async logout() {
    await this.get('/logout');
    this.setToken(null);
  }

  async checkAuth() {
    return this.get('/auth/check');
  }

  // User endpoints
  async getProfile() {
    return this.get('/auth/user');
  }

  async updateProfile(data) {
    return this.patch('/auth/user', data);
  }

  // Document endpoints
  async getDocuments(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/documents${query ? '?' + query : ''}`);
  }

  async uploadDocument(formData) {
    const response = await fetch(`${this.baseURL}/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }
}
