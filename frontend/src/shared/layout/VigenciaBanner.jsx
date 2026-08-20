import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { diasParaVencerVigencia, vigenciaProximaAVencer } from '../vigencia';

// Mismo criterio que 'ventix_sidebar_colapsado' (Sidebar.jsx) para preferencias de UI en
// localStorage. Guarda {empresaId, vigenciaHasta, fecha} -- si cualquiera de los tres cambia
// (otro día, u otra vigencia porque el superadmin renovó/cambió el plan) el cierre queda
// obsoleto y el banner vuelve a aparecer. Sin esto el cierre sería definitivo y dejaría de
// cumplir su propósito de recordatorio.
const CLAVE_CIERRE = 'ventix_vigencia_banner_cerrado';

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function estaCerradoHoy({ empresaId, vigenciaHasta }) {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_CIERRE) || 'null');
    return !!guardado
      && guardado.empresaId === empresaId
      && guardado.vigenciaHasta === vigenciaHasta
      && guardado.fecha === hoyISO();
  } catch {
    return false;
  }
}

// Franja fija arriba del dashboard (además de la campanita de TopBar) cuando falten pocos días
// de vigencia -- a pedido explícito del usuario del proyecto, para que sea difícil de ignorar y
// empuje a que la empresa se contacte para renovar su plan. Mismo criterio de audiencia que la
// campanita: solo quien administra la empresa (administracion.empresa.editar). Se puede cerrar
// con la "x" (a pedido explícito) -- vuelve a aparecer al día siguiente, o antes si cambia la
// vigencia, para no dejar de cumplir su función de recordatorio.
function VigenciaBanner() {
  const navigate = useNavigate();
  const { permisos, empresa } = useAuth();
  const [cerrado, setCerrado] = useState(true);

  const puedeVer = permisos?.includes('administracion.empresa.editar');
  const aplica = puedeVer && vigenciaProximaAVencer(empresa?.vigenciaHasta);

  useEffect(() => {
    if (!aplica) return;
    setCerrado(estaCerradoHoy({ empresaId: empresa.id, vigenciaHasta: empresa.vigenciaHasta }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplica, empresa?.id, empresa?.vigenciaHasta]);

  if (!aplica || cerrado) return null;

  function cerrar() {
    localStorage.setItem(CLAVE_CIERRE, JSON.stringify({
      empresaId: empresa.id, vigenciaHasta: empresa.vigenciaHasta, fecha: hoyISO(),
    }));
    setCerrado(true);
  }

  const dias = diasParaVencerVigencia(empresa.vigenciaHasta);
  const texto = dias < 0
    ? 'Tu suscripción a BOX POS venció.'
    : dias === 0
      ? 'Tu suscripción a BOX POS vence hoy.'
      : `Tu suscripción a BOX POS vence en ${dias} día${dias === 1 ? '' : 's'}.`;

  return (
    <div className="flex w-full shrink-0 items-center gap-2 bg-danger-600 px-4 py-2 text-sm font-medium text-white">
      <button
        type="button"
        onClick={() => navigate('/administracion/empresa')}
        className="flex flex-1 items-center justify-center gap-2 text-center hover:underline"
      >
        <AlertTriangle size={16} className="shrink-0" />
        {texto} Contactá al administrador de la plataforma para renovarla.
      </button>
      <button
        type="button"
        onClick={cerrar}
        aria-label="Cerrar aviso"
        className="shrink-0 rounded p-1 hover:bg-danger-700"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default VigenciaBanner;
