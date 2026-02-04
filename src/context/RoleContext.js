import React, { createContext, useContext, useEffect, useState } from 'react';
import { getRoleConfigs } from '../configApi';

const RoleContext = createContext();

export function RoleProvider({ children }) {
    const [allowedViews, setAllowedViews] = useState([]); // null means all (dev), [] means none, ['id'] means specific
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState('user');

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const raw = localStorage.getItem('auth_session_v1');
            let currentRole = 'user';
            if (raw) {
                try {
                    currentRole = JSON.parse(raw).role || 'user';
                } catch (e) { }
            }
            setRole(currentRole);



            console.log('[RoleContext] Loading config for role:', currentRole);
            const configs = await getRoleConfigs();
            console.log('[RoleContext] Fetched configs:', configs);
            const myConfig = configs.find(c => c.role === currentRole);
            console.log('[RoleContext] Matched config:', myConfig);

            if (myConfig) {
                try {
                    const parsed = JSON.parse(myConfig.views);
                    console.log('[RoleContext] Parsed views:', parsed);
                    setAllowedViews(parsed);
                } catch (e) {
                    console.error('[RoleContext] Error parsing views:', e);
                    setAllowedViews([]);
                }
            } else {
                console.warn('[RoleContext] No config found for role:', currentRole);
                setAllowedViews([]);
            }
        } catch (e) {
            console.error("Error loading role config", e);
            setAllowedViews([]);
        } finally {
            setLoading(false);
        }
    };

    const hasAccess = (viewId) => {
        if (allowedViews === null) return true;
        return allowedViews.includes(viewId);
    };

    return (
        <RoleContext.Provider value={{ allowedViews, hasAccess, loading, role, reloadConfig: loadConfig }}>
            {children}
        </RoleContext.Provider>
    );
}

export function useRole() {
    return useContext(RoleContext);
}
