import { createContext, useContext, useEffect, useState } from 'react';
import { TOKEN_KEY } from '../api';
import { login as loginRequest, me as meRequest } from '../../modules/core/api/core.api';

const AuthContext = createContext(null);

const CONTEXTO_VACIO = { usuario: null, empresa: null, rol: null, permisos: [] };

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading'); // loading | anon | auth
  const [contexto, setContexto] = useState(CONTEXTO_VACIO);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setStatus('anon');
      return;
    }
    meRequest()
      .then((data) => {
        setContexto(data);
        setStatus('auth');
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setStatus('anon');
      });
  }, []);

  // Guarda el token y adelanta usuario/empresa/rol desde la respuesta de login/registro;
  // los permisos resueltos en vivo llegan después vía /me, sin bloquear la navegación.
  function setSesion(data) {
    localStorage.setItem(TOKEN_KEY, data.token);
    setContexto({ usuario: data.usuario, empresa: data.empresa, rol: data.rol, permisos: [] });
    setStatus('auth');
    meRequest().then(setContexto).catch(() => {});
  }

  async function login(credenciales) {
    const data = await loginRequest(credenciales);
    setSesion(data);
    return data;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setContexto(CONTEXTO_VACIO);
    setStatus('anon');
  }

  return (
    <AuthContext.Provider value={{ status, ...contexto, login, setSesion, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
