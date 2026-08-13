import Input from '../../../shared/ui/Input';
import SelectorCatalogoSat from '../../../shared/ui/SelectorCatalogoSat';

// Bloque de campos del receptor de un CFDI, reusado por Factura Directa, el modal de
// "Facturar" desde una venta del POS, y Consolidada/Global (cuando el receptor es un cliente
// identificado, no el RFC genérico). `value` es {rfc, nombre, regimenFiscal, usoCfdi,
// domicilioFiscalCp}, `onChange(campo, valor)` actualiza un campo a la vez.
function ReceptorFiscalCampos({ value, onChange, idPrefix = 'receptor' }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Input
        id={`${idPrefix}-rfc`}
        label="RFC"
        value={value.rfc}
        onChange={(e) => onChange('rfc', e.target.value)}
        placeholder="XAXX010101000"
        required
      />
      <Input
        id={`${idPrefix}-nombre`}
        label="Nombre / razón social"
        value={value.nombre}
        onChange={(e) => onChange('nombre', e.target.value)}
        required
      />
      <SelectorCatalogoSat
        id={`${idPrefix}-regimen`}
        tipo="RegimenFiscal"
        label="Régimen fiscal"
        value={value.regimenFiscal || null}
        onChange={(v) => onChange('regimenFiscal', v)}
        placeholder="Buscar régimen fiscal…"
        required
      />
      <SelectorCatalogoSat
        id={`${idPrefix}-uso`}
        tipo="UsoCfdi"
        label="Uso del CFDI"
        value={value.usoCfdi || null}
        onChange={(v) => onChange('usoCfdi', v)}
        placeholder="Buscar uso de CFDI…"
        required
      />
      <Input
        id={`${idPrefix}-cp`}
        label="Código postal (domicilio fiscal)"
        value={value.domicilioFiscalCp}
        onChange={(e) => onChange('domicilioFiscalCp', e.target.value)}
        required
      />
    </div>
  );
}

export const RECEPTOR_VACIO = {
  rfc: '', nombre: '', regimenFiscal: null, usoCfdi: null, domicilioFiscalCp: '',
};

// Prellena desde un Cliente ya guardado (rfc/regimenFiscalClave/usoCfdiPreferido/
// domicilioFiscalCp) -- siempre queda editable, un cliente puede no tener estos datos
// capturados (ej. Cliente General).
export function receptorDesdeCliente(cliente) {
  return {
    rfc: cliente?.rfc || '',
    nombre: cliente?.nombre || '',
    regimenFiscal: cliente?.regimenFiscalClave || null,
    usoCfdi: cliente?.usoCfdiPreferido || null,
    domicilioFiscalCp: cliente?.domicilioFiscalCp || '',
  };
}

export default ReceptorFiscalCampos;
