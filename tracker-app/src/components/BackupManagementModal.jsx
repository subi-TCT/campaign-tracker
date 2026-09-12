import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Trash2,
  RefreshCw,
  FileSpreadsheet,
  HardDrive,
  Cloud,
  Mail,
  Send,
  CheckCircle,
  AlertCircle,
  Clock,
  Archive,
  Layers,
  Sparkles
} from 'lucide-react';

export default function BackupManagementModal({ isOpen, onClose, authToken, API_BASE }) {
  const [backups, setBackups] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setActionMsg({ type: '', text: '' });
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${authToken}` };
      const [listRes, statusRes] = await Promise.all([
        fetch(`${API_BASE}/backup/list`, { headers }),
        fetch(`${API_BASE}/backup/status`, { headers })
      ]);

      if (listRes.ok) {
        const listData = await listRes.json();
        setBackups(listData.backups || []);
      }
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }
    } catch (err) {
      console.error('Failed to load backup data:', err);
      setActionMsg({ type: 'error', text: 'Failed to load backup status from server.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    setActionMsg({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE}/backup/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const emailSent = data.cloudResults?.email?.success ? ' • Email sent' : '';
        const tgSent = data.cloudResults?.telegram?.success ? ' • Telegram sent' : '';
        setActionMsg({
          type: 'success',
          text: `Backup cycle completed successfully in ${(data.durationMs / 1000).toFixed(1)}s! (${data.sqliteFile?.filename})${emailSent}${tgSent}`
        });
        await fetchData();
      } else {
        setActionMsg({
          type: 'error',
          text: data.error || 'Failed to create backup snapshot.'
        });
      }
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message || 'Network error creating backup.' });
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (filename) => {
    try {
      const res = await fetch(`${API_BASE}/backup/download/${encodeURIComponent(filename)}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Download failed from server');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(`Could not download file: ${err.message}`);
    }
  };

  const handleDelete = async (filename) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${filename}"?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/backup/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionMsg({ type: 'success', text: `Deleted "${filename}" successfully.` });
        setBackups(prev => prev.filter(b => b.filename !== filename));
      } else {
        setActionMsg({ type: 'error', text: data.error || 'Failed to delete backup.' });
      }
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message || 'Error deleting backup.' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{
          maxWidth: 860,
          width: '94%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.15)',
                padding: 8,
                borderRadius: 8,
                color: '#60a5fa',
                display: 'flex'
              }}
            >
              <HardDrive size={22} />
            </div>
            <div>
              <h3
                className="drawer-title"
                style={{ margin: 0, fontSize: 18, color: 'var(--color-text-white)' }}
              >
                Database & Cloud Backups Management
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
                Atomic SQLite snapshots, multi-sheet Master Excel workbooks, and off-site cloud delivery
              </p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 18
          }}
        >
          {/* Status Alert Banner */}
          {actionMsg.text && (
            <div
              className={actionMsg.type === 'error' ? 'login-error-banner' : ''}
              style={
                actionMsg.type === 'success'
                  ? {
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#34d399',
                      padding: '10px 14px',
                      borderRadius: 8,
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }
                  : {}
              }
            >
              {actionMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
              <span>{actionMsg.text}</span>
            </div>
          )}

          {/* Metric KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12
            }}
          >
            {/* Storage Usage Card */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: '12px 16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>
                <Archive size={14} /> Total Local Backups
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text-white)' }}>
                {status?.totalBackups ?? backups.length} files
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                Disk space: {status?.totalDiskUsage || '0 MB'} (Auto-pruned at 15)
              </div>
            </div>

            {/* Last Backup Card */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: '12px 16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>
                <Clock size={14} /> Last Backup Generated
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', marginTop: 4 }}>
                {status?.lastBackupTime
                  ? new Date(status.lastBackupTime).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'No backups recorded yet'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                Schedule: {status?.schedule ? 'Active (Daily)' : 'Manual'}
              </div>
            </div>

            {/* Cloud Channels Card */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: '12px 16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>
                <Cloud size={14} /> Off-Site Cloud Channels
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#cbd5e1' }}>
                    <Mail size={12} /> Email (SMTP):
                  </span>
                  <span
                    style={{
                      padding: '1px 6px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      background: status?.cloudChannels?.emailConfigured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: status?.cloudChannels?.emailConfigured ? '#34d399' : '#fbbf24'
                    }}
                  >
                    {status?.cloudChannels?.emailConfigured ? 'Connected' : 'Configure in .env'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#cbd5e1' }}>
                    <Send size={12} /> Telegram Bot:
                  </span>
                  <span
                    style={{
                      padding: '1px 6px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      background: status?.cloudChannels?.telegramConfigured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                      color: status?.cloudChannels?.telegramConfigured ? '#34d399' : '#94a3b8'
                    }}
                  >
                    {status?.cloudChannels?.telegramConfigured ? 'Connected' : 'Optional'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Trigger Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
              background: 'rgba(99, 102, 241, 0.05)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: 10,
              padding: '12px 16px'
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-white)' }}>
                Manual Backup & Master Export Trigger
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Generates a live atomic snapshot of the entire SQLite DB + compiles a 5-sheet Master Excel file
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="btn"
                onClick={fetchData}
                disabled={loading || creating}
                style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <RefreshCw size={13} className={loading ? 'spinning' : ''} /> Refresh
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateBackup}
                disabled={creating}
                style={{
                  padding: '7px 16px',
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                }}
              >
                {creating ? (
                  <>
                    <RefreshCw size={14} className="spinning" /> Snapshotting DB & Compiling Excel...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Create Backup Now
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Historical Backups Table */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
            <div
              style={{
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderBottom: '1px solid var(--border-color)',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--color-text-white)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>Historical Archives ({backups.length})</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 400 }}>
                Safely isolated in <code>tracker-backend/backups/</code>
              </span>
            </div>

            {loading && backups.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <RefreshCw size={20} className="spinning" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                Loading backup history...
              </div>
            ) : backups.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                No backups generated yet. Click <strong>"Create Backup Now"</strong> above to create the first snapshot.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '10px 16px' }}>File / Archive Name</th>
                      <th style={{ padding: '10px 12px' }}>Type</th>
                      <th style={{ padding: '10px 12px' }}>Size</th>
                      <th style={{ padding: '10px 12px' }}>Created Timestamp</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((b) => {
                      const isDb = b.filename.includes('.sqlite') || b.filename.includes('.json');
                      return (
                        <tr
                          key={b.filename}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-text-white)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {isDb ? (
                                <Database size={15} color="#38bdf8" />
                              ) : (
                                <FileSpreadsheet size={15} color="#34d399" />
                              )}
                              <span>{b.filename}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 700,
                                background: isDb ? 'rgba(56, 189, 248, 0.15)' : 'rgba(52, 211, 153, 0.15)',
                                color: isDb ? '#38bdf8' : '#34d399'
                              }}
                            >
                              {b.type}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#cbd5e1', fontFamily: 'monospace' }}>
                            {b.sizeFormatted}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                            {new Date(b.createdAt).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                type="button"
                                className="btn"
                                onClick={() => handleDownload(b.filename)}
                                title={`Download ${b.filename}`}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  background: 'rgba(59, 130, 246, 0.15)',
                                  color: '#60a5fa',
                                  border: '1px solid rgba(59, 130, 246, 0.3)'
                                }}
                              >
                                <Download size={12} /> Download
                              </button>
                              <button
                                type="button"
                                className="btn"
                                onClick={() => handleDelete(b.filename)}
                                title={`Delete ${b.filename}`}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  color: '#f87171',
                                  border: '1px solid rgba(239, 68, 68, 0.3)'
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.2)'
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            Scheduled Cron: <strong>Daily at 23:00 GST</strong> • Retention: <strong>Latest 15 Snapshots</strong>
          </div>
          <button type="button" className="btn" onClick={onClose} style={{ padding: '6px 16px', fontSize: 12 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
