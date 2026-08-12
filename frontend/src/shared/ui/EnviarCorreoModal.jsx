import { useEffect, useState } from 'react';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';

// Modal genérico reusado por Cotizaciones/Compras/Ventas(ticket)/Reportes para enviar un
// documento por correo — no sabe nada de PDFs/CSVs, cada página arma el adjunto (base64) antes
// de llamar a onEnviar. destinatarioSugerido puede venir vacío (p.ej. Cliente General sin
// correo) — el campo siempre queda editable.
function EnviarCorreoModal({
  abierto, onCerrar, titulo = 'Enviar por correo', destinatarioSugerido = '', asuntoSugerido = '',
  enviando = false, error = '', onEnviar,
}) {
  const [destinatario, setDestinatario] = useState('');
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (abierto) {
      setDestinatario(destinatarioSugerido || '');
      setAsunto(asuntoSugerido || '');
      setMensaje('');
    }
    // Solo se re-sincroniza al abrir el modal, no en cada cambio de los "sugerido" (para no
    // pisar lo que el usuario ya escribió mientras el modal sigue abierto).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  function enviar(e) {
    e.preventDefault();
    onEnviar(destinatario, asunto, mensaje);
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo}>
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <Input
          label="Destinatario"
          type="email"
          required
          value={destinatario}
          onChange={(e) => setDestinatario(e.target.value)}
          placeholder="correo@ejemplo.com"
        />
        <Input
          label="Asunto"
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Mensaje (opcional)</label>
          <textarea
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900
              placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            rows={3}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-danger-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default EnviarCorreoModal;
