import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import VigenciaBanner from './VigenciaBanner';

function AppLayout({ children }) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onAbrirMenu={() => setMenuAbierto(true)} />
        <VigenciaBanner />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

export default AppLayout;
