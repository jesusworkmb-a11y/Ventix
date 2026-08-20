import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { diasParaVencerVigencia, vigenciaProximaAVencer } from '../vigencia';

// Franja fija arriba del dashboard (además de la campanita de TopBar) cuando falten pocos días
// de vigencia -- a pedido explícito del usuario del proyecto, para que sea difícil de ignorar y
// empuje a que la empresa se contacte para renovar su plan. Mismo criterio de audiencia que la
// campanita: solo quien administra la empresa (administracion.empresa.editar).
function VigenciaBanner() {
  const navigate = useNavigate();
  const { permisos, empresa } = useAuth();

  const puedeVer = permisos?.includes('administracion.empresa.editar');
  if (!puedeVer || !vigenciaProximaAVencer(empresa?.vigenciaHasta)) return null;

  const dias = diasParaVencerVigencia(empresa.vigenciaHasta);
  const texto = dias < 0
    ? 'Tu suscripción a BOX POS venció.'
    : dias === 0
      ? 'Tu suscripción a BOX POS vence hoy.'
      : `Tu suscripción a BOX POS vence en ${dias} día${dias === 1 ? '' : 's'}.`;

  return (
    <button
      type="button"
      onClick={() => navigate('/administracion/empresa')}
      className="flex w-full shrink-0 items-center justify-center gap-2 bg-danger-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-danger-700"
    >
      <AlertTriangle size={16} className="shrink-0" />
      {texto} Contactá al administrador de la plataforma para renovarla.
    </button>
  );
}

export default VigenciaBanner;
