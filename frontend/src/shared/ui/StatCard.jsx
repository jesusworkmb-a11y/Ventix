const TONOS = {
  primary: { bg: 'bg-primary-50', icon: 'bg-primary-500 text-white' },
  success: { bg: 'bg-success-50', icon: 'bg-success-500 text-white' },
  warning: { bg: 'bg-warning-50', icon: 'bg-warning-500 text-white' },
  danger: { bg: 'bg-danger-50', icon: 'bg-danger-500 text-white' },
};

function StatCard({ tono = 'primary', icono, etiqueta, valor, delta }) {
  const t = TONOS[tono];
  return (
    <div className={`rounded-xl border border-gray-100 p-5 ${t.bg}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${t.icon}`}>
          {icono}
        </div>
        <p className="text-sm text-gray-600">{etiqueta}</p>
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{valor}</p>
      {delta && <p className="mt-1 text-xs font-medium text-success-700">{delta}</p>}
    </div>
  );
}

export default StatCard;
