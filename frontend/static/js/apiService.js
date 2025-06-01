import { showToast } from './toastService.js';

// --- API Base URL ---
// Use the current host instead of hardcoding localhost
export const API_BASE_URL = `${window.location.protocol}//${window.location.host}/api`;

// --- Helper Functions ---
export async function apiCall(endpoint, method = 'GET', body = null, queryParams = null) {
    let url = `${API_BASE_URL}${endpoint}`;
    if (queryParams && Object.keys(queryParams).length > 0) {
        const params = new URLSearchParams();
        for (const key in queryParams) {
            if (queryParams[key] !== null && queryParams[key] !== undefined && queryParams[key] !== '') {
                params.append(key, queryParams[key]);
            }
        }
        if (params.toString()) {
             url += `?${params.toString()}`;
        }
    }

    const options = {
        method,
        headers: {
            // Content-Type will be set conditionally below
        }
    };

    if (body) {
        if (body instanceof FormData) {
            // For FormData, don't set Content-Type header;
            // the browser will set it with the correct boundary.
            options.body = body;
        } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
    } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
         // If it's a POST/PUT/PATCH but no body, send empty JSON object by default 
         // if server expects Content-Type application/json. 
         // Some servers might require this. For others, this line can be removed.
         options.headers['Content-Type'] = 'application/json';
         options.body = JSON.stringify({}); 
    }

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            console.error('API Error:', errorData);
            showToast(`API Error: ${errorData.error || 'Unknown API error'}`, 'error');
            return null;
        }
        if (response.status === 204) { // No Content
            return true; 
        }
        return await response.json();
    } catch (error) {
        console.error('Fetch Error:', error);
        showToast(`Network Error: ${error.message}`, 'error');
        return null;
    }
}