import { useState, useEffect, useCallback } from 'react';
import { api, setToken, getToken, clearToken } from '../services/api';
import { AuthResponse, User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  profileComplete: boolean;
  missingFields: string[];
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    profileComplete: false,
    missingFields: [],
  });

  const authenticate = useCallback(async (requestLogin: () => Promise<AuthResponse>) => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const result = await requestLogin();
      setToken(result.token);
      setState({
        user: result.user,
        loading: false,
        error: null,
        profileComplete: result.profileComplete,
        missingFields: result.missingFields,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'خطا در ورود';
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw error;
    }
  }, []);

  const login = useCallback((initData: string) => authenticate(() => api.auth.login(initData)), [authenticate]);
  const loginLocally = useCallback(() => authenticate(api.auth.localTelegramLogin), [authenticate]);

  const refreshProfile = useCallback(async () => {
    try {
      const result = await api.users.getProfile();
      setState((prev) => ({
        ...prev,
        user: result.user,
        profileComplete: result.profileComplete,
        missingFields: result.missingFields,
      }));
    } catch {
      // silently fail
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setState({ user: null, loading: false, error: null, profileComplete: false, missingFields: [] });
  }, []);

  useEffect(() => {
    const token = getToken();
    if (token) {
      api.users
        .getProfile()
        .then((result) => {
          setState({
            user: result.user,
            loading: false,
            error: null,
            profileComplete: result.profileComplete,
            missingFields: result.missingFields,
          });
        })
        .catch(() => {
          clearToken();
          setState((prev) => ({ ...prev, loading: false }));
        });
    } else {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  return { ...state, login, loginLocally, logout, refreshProfile };
}
