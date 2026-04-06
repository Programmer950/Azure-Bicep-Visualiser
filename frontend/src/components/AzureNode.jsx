import { Handle, Position } from '@xyflow/react';
import { Database, Cloud, Network, Server, AlertTriangle, Lock, Globe, Box, Hexagon } from 'lucide-react';

const iconMap = {
    vnet: <Cloud size={20} color="var(--text-muted)" />,
    subnet: <Network size={20} color="var(--text-muted)" />,
    server: <Server size={20} color="var(--text-muted)" />,
    storage: <Database size={20} color="var(--text-muted)" />,
    database: <Database size={20} color="#3b82f6" />,
    keyvault: <Lock size={20} color="#eab308" />,
    web: <Globe size={20} color="var(--text-muted)" />,
    kubernetes: <Hexagon size={20} color="#3b82f6" />,
    default: <Box size={20} color="var(--text-muted)" />
};

export default function AzureNode({ data }) {
    const isViolating = data.isViolating;
    const shortType = data.azureType ? data.azureType.split('/').pop() : 'Resource';

    return (
        <div style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-panel)',
            backdropFilter: 'blur(10px)',
            border: isViolating ? '1px solid var(--accent-red)' : '1px solid var(--border-bright)',
            boxShadow: isViolating ? '0 0 20px rgba(239, 68, 68, 0.15)' : 'var(--shadow-soft)',
            color: 'var(--text-main)',
            display: 'flex',
            flexDirection: 'column',
            minWidth: '200px',
            transition: 'all 0.3s ease'
        }}>
            <Handle type="target" position={Position.Top} style={{ background: 'var(--text-muted)', border: 'none', width: '6px', height: '6px' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '8px', backgroundColor: 'var(--bg-deep)', borderRadius: '8px', border: '1px solid var(--border-dim)', color: 'var(--text-muted)' }}>
                        {iconMap[data.icon] || iconMap.default}
                    </div>
                    <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{shortType}</div>
                        {data.location && (
                            <div style={{
                                fontSize: '9px',
                                padding: '2px 6px',
                                backgroundColor: 'var(--bg-deep)',
                                border: '1px solid var(--border-dim)',
                                borderRadius: '4px',
                                color: 'var(--text-muted)',
                                opacity: 0.8
                            }}>
                                {data.location}
                            </div>
                        )}
                        <strong style={{ fontSize: '14px', letterSpacing: '0.2px' }}>{data.label}</strong>
                    </div>
                </div>
                {isViolating && <AlertTriangle size={20} color="var(--accent-red)" />}
            </div>

            {isViolating && (
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '11px', color: 'var(--accent-red)', lineHeight: '1.4' }}>
                    {data.violationMessage}
                </div>
            )}

            <Handle type="source" position={Position.Bottom} style={{ background: 'var(--text-muted)', border: 'none', width: '6px', height: '6px' }} />
        </div>
    );
}