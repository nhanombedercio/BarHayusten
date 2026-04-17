import { useState, useRef, useEffect } from 'react';
import {
  downloadBackup, parseBackupFile, restoreBackup,
  getBackupHistory, getStorageUsage, formatBytes,
  BackupHistoryEntry, BackupManifest,
} from '@/utils/backup';
import { useAuth } from '@/store/AuthContext';
import ConfirmDeleteModal from '@/components/base/ConfirmDeleteModal';
import { db } from '@/store/db';

export default function BackupSettings() {
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [history, setHistory] = useState<BackupHistoryEntry[]>([]);
  const [storage, setStorage] = useState(getStorageUsage());
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState('');
  const [restoreFile, setRestoreFile] = useState<BackupManifest | null>(null);
  const [restoreFilename, setRestoreFilename] = useState('');
  const [restoreResult, setRestoreResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setHistory(getBackupHistory());
    setStorage(getStorageUsage());
  }, []);

  const handleDownload = () => {
    setIsDownloading(true);
    setTimeout(() => {
      const filename = downloadBackup(currentUser?.name || 'Admin');
      setDownloadSuccess(`Backup guardado: ${filename}`);
      setHistory(getBackupHistory());
      setStorage(getStorageUsage());
      setIsDownloading(false);
      setTimeout(() => setDownloadSuccess(''), 4000);
    }, 600);
  };

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setRestoreResult({ success: false, message: 'Apenas ficheiros .json são aceites.' });
      return;
    }
    try {
      const manifest = await parseBackupFile(file);
      setRestoreFile(manifest);
      setRestoreFilename(file.name);
      setRestoreResult(null);
    } catch (err) {
      setRestoreResult({ success: false, message: err instanceof Error ? err.message : 'Erro ao ler ficheiro' });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleRestore = () => {
    if (!restoreFile) return;
    const result = restoreBackup(restoreFile);
    setRestoreResult(result);
    setShowRestoreConfirm(false);
    if (result.success) {
      setRestoreFile(null);
      setRestoreFilename('');
      setStorage(getStorageUsage());
    }
  };

  const handleReset = () => {
    db.resetAll();
    setShowResetConfirm(false);
    setStorage(getStorageUsage());
    setRestoreResult({ success: true, message: 'Sistema reposto para os dados de fábrica. Recarregue a página.' });
    setTimeout(() => window.location.reload(), 2000);
  };

  const storageColor = storage.percentage > 80 ? 'bg-red-500' : storage.percentage > 60 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 font-bold text-lg mb-1">Backup & Restauro</h2>
        <p className="text-gray-500 text-sm">Proteja os seus dados exportando backups regulares e restaure quando necessário.</p>
      </div>

      {/* Storage Usage */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-gray-800 font-semibold text-sm flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center"><i className="ri-database-2-line text-gray-500"></i></div>
            Armazenamento Local
          </h3>
          <span className="text-gray-500 text-xs">{formatBytes(storage.used)} / ~5 MB</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2">
          <div className={`h-2.5 rounded-full transition-all ${storageColor}`} style={{ width: `${storage.percentage}%` }}></div>
        </div>
        <p className="text-gray-400 text-xs">{storage.percentage.toFixed(1)}% utilizado</p>
      </div>

      {/* Download Backup */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-gray-800 font-semibold text-sm mb-1">Criar Backup Completo</h3>
            <p className="text-gray-500 text-xs">Exporta todos os dados: produtos, vendas, clientes, dívidas, utilizadores, configurações e histórico de caixa.</p>
          </div>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl cursor-pointer whitespace-nowrap hover:opacity-90 disabled:opacity-60 transition-all flex-shrink-0 ml-4"
            style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
            {isDownloading
              ? <><i className="ri-loader-4-line animate-spin"></i> A criar...</>
              : <><i className="ri-download-2-line"></i> Descarregar Backup</>
            }
          </button>
        </div>

        {downloadSuccess && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <i className="ri-check-line text-emerald-600 text-sm"></i>
            </div>
            <span className="text-emerald-700 text-xs font-medium">{downloadSuccess}</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Produtos', count: db.getProducts().length, icon: 'ri-archive-line', color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Clientes', count: db.getClients().length, icon: 'ri-user-3-line', color: 'text-sky-600', bg: 'bg-sky-50' },
            { label: 'Vendas', count: db.getSales().length, icon: 'ri-shopping-cart-line', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Dívidas', count: db.getDebts().length, icon: 'ri-file-warning-line', color: 'text-red-500', bg: 'bg-red-50' },
            { label: 'Utilizadores', count: db.getUsers().length, icon: 'ri-team-line', color: 'text-gray-600', bg: 'bg-gray-50' },
            { label: 'Movimentos', count: db.getMovements().length, icon: 'ri-arrow-up-down-line', color: 'text-gray-600', bg: 'bg-gray-50' },

          ].map(item => (
            <div key={item.label} className={`${item.bg} rounded-xl p-3 flex items-center gap-2`}>
              <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                <i className={`${item.icon} ${item.color} text-base`}></i>
              </div>
              <div>
                <p className="text-gray-500 text-xs">{item.label}</p>
                <p className={`font-bold text-sm ${item.color}`}>{item.count}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Restore Backup */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-gray-800 font-semibold text-sm mb-1">Restaurar Backup</h3>
        <p className="text-gray-500 text-xs mb-4">Selecione um ficheiro .json de backup para restaurar todos os dados. <strong className="text-amber-600">Atenção: os dados atuais serão substituídos.</strong></p>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragging ? 'border-sky-400 bg-sky-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
          <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full mx-auto mb-3">
            <i className="ri-upload-cloud-2-line text-gray-400 text-2xl"></i>
          </div>
          <p className="text-gray-600 text-sm font-medium">Arraste o ficheiro aqui ou clique para selecionar</p>
          <p className="text-gray-400 text-xs mt-1">Apenas ficheiros .json de backup do Hayusten BarOne</p>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
        </div>

        {/* File preview */}
        {restoreFile && (
          <div className="mt-4 bg-sky-50 border border-sky-100 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sky-800 font-semibold text-sm flex items-center gap-1.5">
                  <i className="ri-file-check-line"></i> {restoreFilename}
                </p>
                <p className="text-sky-600 text-xs mt-0.5">
                  Criado em {new Date(restoreFile.createdAt).toLocaleString('pt-PT')} por {restoreFile.createdBy}
                </p>
              </div>
              <button onClick={() => { setRestoreFile(null); setRestoreFilename(''); }}
                className="w-6 h-6 flex items-center justify-center text-sky-400 hover:text-sky-600 cursor-pointer">
                <i className="ri-close-line text-sm"></i>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {Object.entries(restoreFile.recordCounts).map(([key, count]) => (
                <div key={key} className="bg-white rounded-lg px-2 py-1.5 text-center">
                  <p className="text-gray-500 text-xs capitalize">{key}</p>
                  <p className="text-gray-900 font-bold text-sm">{count}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                <i className="ri-alert-line text-amber-600 text-sm"></i>
              </div>
              <p className="text-amber-700 text-xs">Os dados atuais serão completamente substituídos pelos dados do backup. Esta ação é irreversível.</p>
            </div>
            <button onClick={() => setShowRestoreConfirm(true)}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap transition-all">
              Restaurar Este Backup
            </button>
          </div>
        )}

        {restoreResult && (
          <div className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 ${restoreResult.success ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className={`${restoreResult.success ? 'ri-check-line text-emerald-600' : 'ri-close-circle-line text-red-500'} text-sm`}></i>
            </div>
            <p className={`text-xs font-medium ${restoreResult.success ? 'text-emerald-700' : 'text-red-700'}`}>{restoreResult.message}</p>
          </div>
        )}
      </div>

      {/* Backup History */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-gray-800 font-semibold text-sm mb-4 flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center"><i className="ri-history-line text-gray-500"></i></div>
            Histórico de Backups
          </h3>
          <div className="space-y-2">
            {history.map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-2.5 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-lg flex-shrink-0">
                    <i className="ri-file-zip-line text-gray-400 text-sm"></i>
                  </div>
                  <div>
                    <p className="text-gray-700 text-sm font-medium">{entry.filename}</p>
                    <p className="text-gray-400 text-xs">
                      {new Date(entry.createdAt).toLocaleString('pt-PT')} · {entry.createdBy} · {formatBytes(entry.size)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-gray-500 text-xs">
                      {Object.values(entry.recordCounts).reduce((a, b) => a + b, 0)} registos
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="bg-white rounded-xl border border-red-100 p-5">
        <h3 className="text-red-600 font-semibold text-sm mb-1 flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center"><i className="ri-alert-line text-red-500"></i></div>
          Zona de Perigo
        </h3>
        <p className="text-gray-500 text-xs mb-4">Repor o sistema apaga todos os dados e restaura os dados de exemplo de fábrica. Esta ação é irreversível.</p>
        <button onClick={() => setShowResetConfirm(true)}
          className="flex items-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium px-4 py-2 rounded-xl cursor-pointer whitespace-nowrap transition-all">
          <i className="ri-restart-line"></i> Repor Sistema para Fábrica
        </button>
      </div>

      {showRestoreConfirm && (
        <ConfirmDeleteModal
          title="Confirmar Restauro?"
          description={`Todos os dados atuais serão substituídos pelos dados do backup "${restoreFilename}". Esta ação não pode ser desfeita.`}
          onConfirm={handleRestore}
          onCancel={() => setShowRestoreConfirm(false)}
        />
      )}

      {showResetConfirm && (
        <ConfirmDeleteModal
          title="Repor Sistema para Fábrica?"
          description="TODOS os dados serão apagados permanentemente e substituídos pelos dados de exemplo iniciais. Faça um backup antes de continuar."
          onConfirm={handleReset}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </div>
  );
}
