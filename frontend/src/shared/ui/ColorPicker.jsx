const HEX_VALIDO = /^#[0-9A-Fa-f]{6}$/;

// Swatch de color + hex de texto, mismo look de Input/Select del design system. `value` es un
// hex válido o null (usa `valorPorDefecto` como color del swatch cuando no hay personalización
// todavía, sin escribirlo hasta que el usuario realmente cambie algo).
function ColorPicker({ label, value, valorPorDefecto = '#0F172A', onChange, id }) {
  const colorSwatch = (value && HEX_VALIDO.test(value)) ? value : valorPorDefecto;

  function handleHexChange(texto) {
    const limpio = texto.trim();
    if (limpio === '') { onChange(null); return; }
    onChange(limpio.startsWith('#') ? limpio : `#${limpio}`);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>}
      <div className="flex items-center gap-2">
        <input
          type="color"
          id={id}
          value={colorSwatch}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-gray-300 bg-white p-1"
        />
        <input
          type="text"
          value={value || ''}
          placeholder={valorPorDefecto}
          onChange={(e) => handleHexChange(e.target.value)}
          maxLength={7}
          className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>
    </div>
  );
}

export default ColorPicker;
