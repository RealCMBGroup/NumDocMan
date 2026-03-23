import React, { useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';

export default function AuthCallback() {
  const hasProcessed = useRef(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', '?'));
    const sessionId = params.get('session_id');

    if (!sessionId) {
      navigate('/login');
      return;
    }

    (async () => {
      try {
        const res = await api.post('/auth/google/callback', { session_id: sessionId });
        login(res.data.token, res.data.user);
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('OAuth callback error:', err);
        navigate('/login');
      }
    })();
  }, [login, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#2E60CC] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground font-ibm">Authentification en cours...</p>
      </div>
    </div>
  );
}
