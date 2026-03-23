import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { X } from 'lucide-react';

export default function SignatureModal({ documentId, onClose, onSigned }) {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const [mode, setMode] = useState('draw');
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [typedSig, setTypedSig] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();
  const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const [form, setForm] = useState({
    title: '',
    name: '',
    company: '',
    entity: '',
    email: '',
    signed_at: localISO,
    timezone: tz,
  });

  useEffect(() => {
    if (mode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      setHasSignature(false);
    }
  }, [mode]);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    setIsDrawing(true);
    setLastPos(getPos(e, canvas));
  };

  const draw = (e) => {
    if (!isDrawing || !canvasRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setLastPos(pos);
    setHasSignature(true);
  };

  const endDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasSignature(false);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.company || !form.email) {
      toast.error(t('errors.required_field'));
      return;
    }
    if (mode === 'draw' && !hasSignature) {
      toast.error(t('signature.draw_signature'));
      return;
    }
    if (mode === 'type' && !typedSig.trim()) {
      toast.error(t('signature.type_your_name'));
      return;
    }

    let sigData = null;
    if (mode === 'draw' && canvasRef.current) {
      sigData = canvasRef.current.toDataURL('image/png');
    } else {
      sigData = typedSig;
    }

    setSubmitting(true);
    try {
      const api = (await import('../api/api')).default;
      const payload = {
        ...form,
        signed_at: new Date(form.signed_at).toISOString(),
        signature_data: sigData,
        signature_type: mode,
      };
      const res = await api.post(`/documents/${documentId}/signatures`, payload);
      toast.success(t('success'));
      onSigned?.(res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('errors.unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-md border border-[#E2E8F0] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="font-chivo font-700 text-base text-[#121212]">{t('signature.title')}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#F1F3F5]" style={{ transition: 'background-color 150ms ease' }}>
            <X size={18} className="text-[#868E96]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Signature area */}
          <div>
            <div className="flex gap-2 mb-3">
              {['draw', 'type'].map((m) => (
                <button
                  key={m}
                  type="button"
                  data-testid={`sig-mode-${m}`}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 text-sm rounded-md border font-ibm transition-colors duration-150 ${
                    mode === m ? 'bg-[#2E60CC] text-white border-[#2E60CC]' : 'bg-white text-[#495057] border-[#E2E8F0]'
                  }`}
                >
                  {t(`signature.${m}`)}
                </button>
              ))}
            </div>

            {mode === 'draw' ? (
              <div>
                <p className="text-xs text-[#868E96] font-ibm mb-2">{t('signature.draw_signature')}</p>
                <div className="border border-[#E2E8F0] rounded-md overflow-hidden bg-[#F8F9FA]">
                  <canvas
                    ref={canvasRef}
                    width={440}
                    height={140}
                    className="w-full sig-canvas"
                    data-testid="signature-canvas"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                  />
                </div>
                <button type="button" onClick={clearCanvas} className="text-xs text-[#868E96] hover:text-[#E50000] mt-1 font-ibm" style={{ transition: 'color 150ms ease' }}>
                  {t('signature.clear')}
                </button>
              </div>
            ) : (
              <div>
                <p className="text-xs text-[#868E96] font-ibm mb-2">{t('signature.type_your_name')}</p>
                <input
                  data-testid="typed-signature"
                  type="text"
                  value={typedSig}
                  onChange={e => setTypedSig(e.target.value)}
                  placeholder={t('auth.name')}
                  className="ndm-input text-2xl"
                  style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('signature.sig_title')}</label>
              <input data-testid="sig-title" name="title" value={form.title} onChange={handleChange} className="ndm-input" placeholder="Dr., M., Mme..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('signature.sig_name')}</label>
              <input data-testid="sig-name" name="name" value={form.name} onChange={handleChange} className="ndm-input" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('signature.sig_company')}</label>
              <input data-testid="sig-company" name="company" value={form.company} onChange={handleChange} className="ndm-input" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('signature.sig_entity')}</label>
              <input data-testid="sig-entity" name="entity" value={form.entity} onChange={handleChange} className="ndm-input" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('signature.sig_email')}</label>
            <input data-testid="sig-email" type="email" name="email" value={form.email} onChange={handleChange} className="ndm-input" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('signature.sig_datetime')}</label>
              <input data-testid="sig-datetime" type="datetime-local" name="signed_at" value={form.signed_at} onChange={handleChange} className="ndm-input" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('signature.sig_timezone')}</label>
              <input data-testid="sig-timezone" name="timezone" value={form.timezone} onChange={handleChange} className="ndm-input font-mono-ibm text-xs" required />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[#E2E8F0] rounded-md text-[#495057] hover:bg-[#F8F9FA] font-ibm">{t('cancel')}</button>
            <button
              data-testid="confirm-signature"
              type="submit"
              disabled={submitting}
              className="ndm-btn-primary flex items-center gap-2 disabled:opacity-60"
            >
              {submitting && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {t('signature.confirm_sign')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
