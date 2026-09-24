// Distintivo del entorno sandbox (ver "Entorno sandbox" en el README). Solo se muestra si el
// build se hizo con VITE_ENTORNO=sandbox — en producción la variable no existe y esto no
// renderiza nada. Es `fixed` + `pointer-events-none` para no mover el layout de ninguna
// pantalla ni tapar clics: la idea es solo que nunca se confunda el sandbox con producción.
const ENTORNO = import.meta.env.VITE_ENTORNO;

if (ENTORNO === 'sandbox') document.title = `[SANDBOX] ${document.title}`;

function EntornoBadge() {
  if (ENTORNO !== 'sandbox') return null;
  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[100] rounded-full bg-amber-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-lg">
      Sandbox · datos de prueba
    </div>
  );
}

export default EntornoBadge;
