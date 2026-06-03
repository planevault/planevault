// utils/axiosInstance.js
import axios from 'axios';
import toast from 'react-hot-toast';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_DOMAIN_URL,
    withCredentials: false, // Since you're using localStorage
});

// Request interceptor to add token to headers
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle token refresh
axiosInstance.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // If error is 401 and we haven't tried to refresh yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                
                if (!refreshToken) {
                    // No refresh token, clear storage and redirect
                    clearUserDataAndRedirect();
                    return Promise.reject(error);
                }

                // Attempt to refresh the token
                const response = await axios.post(
                    `${import.meta.env.VITE_DOMAIN_URL}/api/v1/users/refresh-token`,
                    { refreshToken },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    }
                );

                if (response.data.success) {
                    const { accessToken, refreshToken: newRefreshToken } = response.data.data;
                    
                    // Store new tokens
                    localStorage.setItem('accessToken', accessToken);
                    if (newRefreshToken) {
                        localStorage.setItem('refreshToken', newRefreshToken);
                    }

                    // Retry the original request with new token
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                    return axiosInstance(originalRequest);
                } else {
                    // Refresh failed, clear storage and redirect
                    clearUserDataAndRedirect();
                    return Promise.reject(error);
                }
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
                // Refresh failed, clear storage and redirect
                clearUserDataAndRedirect();
                return Promise.reject(refreshError);
            }
        } else if (error.response?.status === 401 && originalRequest._retry) {
            // If we've already tried refreshing and still get 401, clear tokens and redirect
            clearUserDataAndRedirect();
            return Promise.reject(error);
        }

        return Promise.reject(error);
    }
);

// Helper function to clear user data and redirect
const clearUserDataAndRedirect = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    // Optional: Show toast message
    toast.error('Session expired. Please log in again.');
    
    // Optional: Redirect to login page if not already there
    if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
        window.location.href = '/login';
    }
};

export default axiosInstance;