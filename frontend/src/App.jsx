import { useEffect, useState } from 'react';
import api from './shared/api';

// Este componente valida el criterio de salida de la Fase 0: React -> Express -> PostgreSQL
// funcionando end-to-end. Se reemplaza por el enrutamiento real (login, dashboard, módulos)
// a partir de la Fase 1.
function App() {
  const [estado, setEstado] = useState('verificando...');

  useEffect(() => {
    api
      .get('/health')
      .then((res) => setEstado(`conectado — DB: ${res.data.db}`))
      .catch(() => setEstado('sin conexión al backend'));
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Ventix</h1>
      <p>Estado del backend: {estado}</p>
    </div>
  );
}

export default App;
