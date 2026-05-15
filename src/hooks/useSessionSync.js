import { useRef, useCallback } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const DEBOUNCE_MS = 3000; // Save at most once every 3 seconds

/**
 * useSessionSync
 * Provides three functions:
 *   loadSession()     → GET /api/session  → returns state blob or null
 *   saveSession(snap) → debounced PUT /api/session (fires at most every 3s)
 *   clearSession()    → DELETE /api/session
 *
 * Auth token is read from localStorage on each call so it always reflects
 * the current logged-in user (matches AuthContext pattern).
 */
export function useSessionSync() {
    const debounceTimer = useRef(null);

    const getToken = () => localStorage.getItem('token');

    const loadSession = useCallback(async () => {
        const token = getToken();
        if (!token) return null;

        try {
            const res = await fetch(`${API_URL}/api/session`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data.session || null;
        } catch (err) {
            console.warn('[SessionSync] loadSession failed:', err);
            return null;
        }
    }, []);

    const saveSession = useCallback((snapshot) => {
        // Debounce — cancel pending timer and restart
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(async () => {
            const token = getToken();
            if (!token) return;

            try {
                await fetch(`${API_URL}/api/session`, {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(snapshot)
                });
                console.log('[SessionSync] Session saved to cloud.');
            } catch (err) {
                console.warn('[SessionSync] saveSession failed:', err);
            }
        }, DEBOUNCE_MS);
    }, []);

    const forceSaveSession = useCallback(async (snapshot) => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        const token = getToken();
        if (!token) return;

        try {
            await fetch(API_URL + '/api/session', {
                method: 'PUT',
                headers: {
                    Authorization: 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(snapshot)
            });
            console.log('[SessionSync] Session force-saved to cloud.');
        } catch (err) {
            console.warn('[SessionSync] forceSaveSession failed:', err);
        }
    }, []);

    const clearSession = useCallback(async () => {
        // Cancel any pending debounced save first
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
            debounceTimer.current = null;
        }

        const token = getToken();
        if (!token) return;

        try {
            await fetch(`${API_URL}/api/session`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('[SessionSync] Session cleared from cloud.');
        } catch (err) {
            console.warn('[SessionSync] clearSession failed:', err);
        }
    }, []);

    return { loadSession, saveSession, forceSaveSession, clearSession };
}
