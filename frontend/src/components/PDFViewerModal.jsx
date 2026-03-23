import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  Download, PenSquare, FileText, RotateCcw
} from 'lucide-react';
import api from '../api/api';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PDFViewerModal({ doc, onClose, onSign }) {
  const { t } = useTranslation();
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [blobUrl, setBlobUrl] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [signatures, setSignatures] = useState([]);
  const containerRef = useRef(null);

  // Fetch file as blob with auth token
  useEffect(() => {
    let url = null;

    (async () => {
      try {
        const response = await api.get(`/documents/${doc.id}/download`, {
          responseType: 'blob',
        });
        url = URL.createObjectURL(response.data);
        setBlobUrl(url);
      } catch {
        setLoadError(true);
      }
    })();

    // Load signatures too
    api.get(`/documents/${doc.id}/signatures`).then(res => setSignatures(res.data)).catch(() => {});

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc.id]);

  const isPDF = doc.mime_type === 'application/pdf' || doc.file_name?.toLowerCase().endsWith('.pdf');

  const handleDocLoad = ({ numPages }) => {
    setNumPages(numPages);
    setCurrentPage(1);
  };

  const goToPrev = () => setCurrentPage(p => Math.max(1, p - 1));
  const goToNext = () => setCurrentPage(p => Math.min(numPages, p + 1));
  const zoomIn = () => setScale(s => Math.min(2.5, parseFloat((s + 0.2).toFixed(1))));
  const zoomOut = () => setScale(s => Math.max(0.5, parseFloat((s - 0.2).toFixed(1))));
  const resetZoom = () => setScale(1.0);

  const handleDownload = () => {
    if (blobUrl) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = doc.file_name || 'document';
      a.click();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1A1A2E]/95 backdrop-blur-sm" data-testid="pdf-viewer-modal">
      {/* Header toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#121212] border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <FileText size={16} className="text-[#2E60CC] flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-ibm font-medium text-white text-sm truncate">{doc.title}</p>
            <p className="font-mono-ibm text-[10px] text-white/40">{doc.doc_id}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPDF && numPages && (
            <>
              {/* Page navigation */}
              <div className="hidden sm:flex items-center gap-1 bg-white/10 rounded-md px-2 py-1">
                <button
                  data-testid="pdf-prev-page"
                  onClick={goToPrev}
                  disabled={currentPage <= 1}
                  className="p-1 rounded hover:bg-white/10 text-white/70 disabled:opacity-30"
                  style={{ transition: 'background-color 150ms ease' }}
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="font-ibm text-xs text-white/70 px-1 tabular-nums">
                  {currentPage} / {numPages}
                </span>
                <button
                  data-testid="pdf-next-page"
                  onClick={goToNext}
                  disabled={currentPage >= numPages}
                  className="p-1 rounded hover:bg-white/10 text-white/70 disabled:opacity-30"
                  style={{ transition: 'background-color 150ms ease' }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Zoom controls */}
              <div className="hidden sm:flex items-center gap-1 bg-white/10 rounded-md px-2 py-1">
                <button
                  data-testid="pdf-zoom-out"
                  onClick={zoomOut}
                  disabled={scale <= 0.5}
                  className="p-1 rounded hover:bg-white/10 text-white/70 disabled:opacity-30"
                  style={{ transition: 'background-color 150ms ease' }}
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  onClick={resetZoom}
                  className="font-mono-ibm text-xs text-white/70 px-1 hover:text-white"
                  style={{ transition: 'color 150ms ease' }}
                >
                  {Math.round(scale * 100)}%
                </button>
                <button
                  data-testid="pdf-zoom-in"
                  onClick={zoomIn}
                  disabled={scale >= 2.5}
                  className="p-1 rounded hover:bg-white/10 text-white/70 disabled:opacity-30"
                  style={{ transition: 'background-color 150ms ease' }}
                >
                  <ZoomIn size={14} />
                </button>
              </div>
            </>
          )}

          {/* Action buttons */}
          <button
            data-testid="pdf-sign-btn"
            onClick={() => onSign?.(doc)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#2E60CC] text-white rounded-md font-ibm"
            style={{ transition: 'background-color 150ms ease' }}
          >
            <PenSquare size={13} />
            {t('sign')}
          </button>

          {doc.has_file && (
            <button
              data-testid="pdf-download-btn"
              onClick={handleDownload}
              className="p-2 rounded-md hover:bg-white/10 text-white/70"
              style={{ transition: 'background-color 150ms ease' }}
              title={t('download')}
            >
              <Download size={16} />
            </button>
          )}

          <button
            data-testid="pdf-close-btn"
            onClick={onClose}
            className="p-2 rounded-md hover:bg-white/10 text-white/70"
            style={{ transition: 'background-color 150ms ease' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* PDF viewer */}
        <div ref={containerRef} className="flex-1 overflow-auto flex justify-center bg-[#2A2A3E] p-4">
          {!doc.has_file ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/40">
              <FileText size={48} className="mb-3" />
              <p className="font-ibm text-sm">{t('document.no_file')}</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/40">
              <FileText size={48} className="mb-3" />
              <p className="font-ibm text-sm text-white/60">Erreur de chargement du fichier</p>
              <button onClick={handleDownload} className="mt-3 flex items-center gap-2 px-4 py-2 bg-[#2E60CC] text-white rounded-md text-sm font-ibm">
                <Download size={14} /> Télécharger
              </button>
            </div>
          ) : !blobUrl ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[#2E60CC] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : isPDF ? (
            <div className="animate-fade-in">
              <Document
                file={blobUrl}
                onLoadSuccess={handleDocLoad}
                onLoadError={() => setLoadError(true)}
                loading={
                  <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-[#2E60CC] border-t-transparent rounded-full animate-spin" />
                  </div>
                }
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="shadow-2xl"
                />
              </Document>

              {/* Mobile page nav */}
              {numPages && numPages > 1 && (
                <div className="flex sm:hidden items-center justify-center gap-4 mt-4">
                  <button onClick={goToPrev} disabled={currentPage <= 1} className="p-2 rounded-full bg-white/10 text-white disabled:opacity-30">
                    <ChevronLeft size={18} />
                  </button>
                  <span className="font-ibm text-sm text-white/70">{currentPage} / {numPages}</span>
                  <button onClick={goToNext} disabled={currentPage >= numPages} className="p-2 rounded-full bg-white/10 text-white disabled:opacity-30">
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Non-PDF file
            <div className="flex flex-col items-center justify-center py-20 text-white/60 gap-4">
              <FileText size={56} className="text-white/20" />
              <div className="text-center">
                <p className="font-ibm font-medium text-white text-base">{doc.file_name}</p>
                <p className="font-ibm text-sm text-white/50 mt-1">
                  {doc.mime_type} · {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : ''}
                </p>
              </div>
              <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-[#2E60CC] text-white rounded-md text-sm font-ibm">
                <Download size={14} /> {t('download')}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar: Metadata + Signatures */}
        <div className="w-64 hidden lg:flex flex-col bg-[#121212] border-l border-white/10 overflow-y-auto">
          {/* Doc info */}
          <div className="p-4 border-b border-white/10">
            <p className="font-ibm text-[10px] text-white/40 uppercase tracking-wide mb-2">Informations</p>
            <div className="space-y-2">
              <InfoRow label={t('document.doc_id')} value={doc.doc_id} mono />
              {doc.doc_type && (
                <InfoRow label={t('document.doc_type')} value={doc.doc_type.name} color={doc.doc_type.color} />
              )}
              {doc.current_state && (
                <InfoRow label={t('document.state')} value={doc.current_state.name} color={doc.current_state.color} />
              )}
              <InfoRow label={t('document.version')} value={`v${doc.version} · Rev. ${doc.revision}`} />
              {doc.phase && <InfoRow label={t('document.phase')} value={doc.phase} mono />}
              {doc.creator && <InfoRow label={t('document.created_by')} value={doc.creator.name} />}
            </div>
          </div>

          {/* Tags */}
          {doc.tags?.length > 0 && (
            <div className="p-4 border-b border-white/10">
              <p className="font-ibm text-[10px] text-white/40 uppercase tracking-wide mb-2">{t('document.tags')}</p>
              <div className="flex flex-wrap gap-1">
                {doc.tags.map((tag, i) => (
                  <span key={i} className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded font-ibm">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Signatures */}
          <div className="p-4 flex-1">
            <p className="font-ibm text-[10px] text-white/40 uppercase tracking-wide mb-3">{t('document.signatures')} ({signatures.length})</p>
            {signatures.length === 0 ? (
              <p className="font-ibm text-xs text-white/30">{t('signature.no_signatures')}</p>
            ) : (
              <div className="space-y-3">
                {signatures.map(sig => (
                  <div key={sig.id} className="border border-white/10 rounded-md p-3">
                    <p className="font-ibm font-medium text-white text-xs">
                      {sig.title ? `${sig.title} ` : ''}{sig.name}
                    </p>
                    <p className="font-ibm text-[10px] text-white/50">{sig.company}{sig.entity ? ` · ${sig.entity}` : ''}</p>
                    <p className="font-ibm text-[10px] text-white/40 mt-1">
                      {new Date(sig.signed_at).toLocaleString()} · {sig.timezone}
                    </p>
                    {sig.signature_type === 'drawn' && sig.signature_data && (
                      <img src={sig.signature_data} alt="sig" className="h-8 mt-2 bg-white/5 rounded" />
                    )}
                    {sig.signature_type === 'type' && sig.signature_data && (
                      <p className="text-base mt-1 text-white/80" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                        {sig.signature_data}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono, color }) {
  return (
    <div>
      <p className="font-ibm text-[9px] text-white/30 uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-1.5 mt-0.5">
        {color && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />}
        <p className={`text-xs text-white/80 ${mono ? 'font-mono-ibm' : 'font-ibm'}`}>{value}</p>
      </div>
    </div>
  );
}
