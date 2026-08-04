import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NAVEGACION } from './navigation';

function itemVisible(item, permisos) {
  if (!item.permiso) return true;
  return permisos?.includes(item.permiso);
}

function grupoVisible(item, permisos) {
  if (!item.hijos) return itemVisible(item, permisos);
  return item.hijos.some((hijo) => itemVisible(hijo, permisos));
}

function Sidebar({ abierto, onCerrar }) {
  const { pathname } = useLocation();
  const { empresa, permisos } = useAuth();
  const [expandido, setExpandido] = useState(() => {
    const activo = NAVEGACION.find((item) => item.hijos?.some((h) => pathname.startsWith(h.to)));
    return activo?.label ?? null;
  });

  return (
    <>
      {abierto && (
        <button
          aria-label="Cerrar menú"
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onCerrar}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy-900 transition-transform
          lg:static lg:translate-x-0
          ${abierto ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 text-lg font-bold text-white">
            V
          </div>
          <span className="text-lg font-bold text-white">Ventix</span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {NAVEGACION.filter((item) => grupoVisible(item, permisos)).map((item) => {
            const Icon = item.icon;
            const activo = pathname.startsWith(item.to) || item.hijos?.some((h) => pathname.startsWith(h.to));

            if (!item.hijos) {
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={onCerrar}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                    ${activo ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            }

            const hijosVisibles = item.hijos.filter((h) => itemVisible(h, permisos));
            const desplegado = expandido === item.label;

            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => setExpandido(desplegado ? null : item.label)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                    ${activo ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                >
                  <Icon size={18} />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${desplegado ? 'rotate-180' : ''}`}
                  />
                </button>
                {desplegado && (
                  <div className="ml-8 mt-1 space-y-1 border-l border-white/10 pl-3">
                    {hijosVisibles.map((hijo) => (
                      <Link
                        key={hijo.to}
                        to={hijo.to}
                        onClick={onCerrar}
                        className={`block rounded-lg px-3 py-1.5 text-sm transition-colors
                          ${pathname === hijo.to ? 'text-white font-medium' : 'text-gray-400 hover:text-white'}`}
                      >
                        {hijo.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 border-t border-white/10 px-4 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-gray-300">
            <Building2 size={16} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{empresa?.nombreComercial || 'Mi empresa'}</p>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
