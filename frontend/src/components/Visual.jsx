import React, { useState, useMemo, useEffect } from "react";
import AzureNode from './AzureNode';
import { ReactFlow, Background, Controls, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { LayoutDashboard, ShieldCheck, Settings, Moon, Sun, LogOut } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import './Visual.css';
import { getLayoutedElements } from './layoutUtils';
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "./authConfig";
import logoImg from './../assets/APSlogosmall.png';

const nodeTypes = { azureNode: AzureNode };

export default function Visual() {
    // --- GLOBAL STATE ---
    const [theme, setTheme] = useState('dark');
    const [currentView, setCurrentView] = useState('dashboard');
    const [isSyncing, setIsSyncing] = useState(false);
    const [scanError, setScanError] = useState(null);
    const [syncError, setSyncError] = useState(null);

    // --- POLICY STATE ---
    const [sourceMode, setSourceMode] = useState('ms');
    const [importedPolicies, setImportedPolicies] = useState([]);
    const [manualPoliciesText, setManualPoliciesText] = useState('[\n  // Paste JSON array of Azure Policies here\n]');
    const [selectedPolicyIndex, setSelectedPolicyIndex] = useState(0);
    const [policyStatus, setPolicyStatus] = useState({});

    // --- DASHBOARD STATE ---
    const [code, setCode] = useState("");
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [isScanning, setIsScanning] = useState(false);

    const { instance, accounts } = useMsal();

    // --- SETTINGS STATE ---
    const [autoScanLineLimit, setAutoScanLineLimit] = useState(10);
    const [layoutDirection, setLayoutDirection] = useState('TB');
    const [nodeSpacing, setNodeSpacing] = useState(100);
    const [animationSpeed, setAnimationSpeed] = useState(2);
    const [isAutoScanEnabled, setIsAutoScanEnabled] = useState(false);

    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    const handleLogout = async () => {
        try {
            await instance.logoutRedirect({
                postLogoutRedirectUri: "/",
            });
        } catch (e) {
            console.error(e);
        }
    };

    const switchToManual = () => {
        setSourceMode('manual');
        if (manualPoliciesText.includes("// Paste JSON")) {
            setManualPoliciesText('[\n  // Paste JSON array of Azure Policies here\n]');
        }
    };

    const switchToMS = () => {
        setSourceMode('ms');
    };

    // --- POLICY TOGGLE LOGIC ---
    const togglePolicy = (policyName) => {
        setPolicyStatus((prev) => ({
            ...prev,
            [policyName]: prev[policyName] === false ? true : false
        }));
    };

    // --- AUTH & SYNC ---
    const handleLogin = async () => {
        try { await instance.loginRedirect(loginRequest); }
        catch (e) { console.error(e); }
    };

    const fetchUserPolicies = async () => {
    if (accounts.length === 0) return;
    setIsSyncing(true);
    try {
        const res = await instance.acquireTokenSilent({ ...loginRequest, account: accounts[0] });
        const backendResponse = await axios.post(`${API_BASE}/api/policies/import`, {}, {
            headers: { Authorization: `Bearer ${res.accessToken}` }
        });
        if (backendResponse.data.status === "success") {
            setImportedPolicies(backendResponse.data.policies);
            const initialStatus = {};
            backendResponse.data.policies.forEach(p => {
                initialStatus[p.displayName] = true;
            });
            setPolicyStatus(initialStatus);
        }
    } catch (error) {
        console.error("Sync failed", error);
    } finally {
        setIsSyncing(false);
    }
};

    // --- SCAN LOGIC ---
    const handleScan = async () => {
    if (!code.trim()) return;

    setScanError(null);

    let policiesToSend = [];
    if (sourceMode === 'ms') {
        policiesToSend = importedPolicies.filter(p => policyStatus[p.displayName] !== false);
        if (policiesToSend.length === 0) {
            return alert("No active policies selected. Please enable at least one in the Policy Lab.");
        }
    } else {
        try {
            policiesToSend = JSON.parse(manualPoliciesText);
            if (!Array.isArray(policiesToSend)) throw new Error("Must be an array");
        } catch (e) {
            return alert("Invalid JSON in Manual Policy Editor.");
        }
    }

    setIsScanning(true);
    try {
        const response = await axios.post(`${API_BASE}/api/scan`, {
            bicep_code: code,
            policies: policiesToSend
        });

        if (response.data.status === 'success') {
            const animatedEdges = response.data.edges.map(edge => ({
                ...edge,
                animated: true,
                style: {
                    ...edge.style,
                    strokeDasharray: '5',
                    animationDuration: `${animationSpeed}s`
                }
            }));

            const { layoutedNodes, layoutedEdges } = getLayoutedElements(
                response.data.nodes,
                animatedEdges,
                layoutDirection,
                nodeSpacing
            );

            setNodes(layoutedNodes);
            setEdges(layoutedEdges);

            setLastScanLineCount(code.split('\n').length);
        }
        else if (response.data.status==='error'){
            if (response.data.error_code===101){
                setScanError(response.data.message);
                console.log(scanError);
            }
        }
    } catch (error) {
        console.error("Scan error:", error);
        const errMsg = error.code === 'ECONNABORTED' || error.message.includes('timeout')
            ? "Connection Timed Out"
            : "Backend Server Unreachable";
        setScanError(errMsg);
    } finally {
        setIsScanning(false);
    }
};

    const [lastScanLineCount, setLastScanLineCount] = useState(0);

    useEffect(() => {
    if (!isAutoScanEnabled) return;

    const currentLineCount = code.split('\n').length;

    if (Math.abs(currentLineCount - lastScanLineCount) >= autoScanLineLimit && code.trim()) {
        handleScan();
        setLastScanLineCount(currentLineCount);
    }
}, [code, isAutoScanEnabled, autoScanLineLimit, lastScanLineCount]);

    // --- VIEWS ---

  const renderDashboard = () => (
    <div className="view-container">
        {/* Bicep Editor Panel */}
        <div className="panel" style={{ width: '40%' }}>
            <div className="panel-header">
                <span className="panel-title">main.bicep</span>
                <button className="btn-primary" onClick={handleScan} disabled={isScanning || !code.trim()}>
                    {isScanning ? <><span className="spinner"></span>SCANNING...</> : 'SCAN INFRA'}
                </button>
            </div>
            <Editor
                path="main.bicep"
                height="calc(100% - 50px)"
                defaultLanguage="bicep"
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                value={code}
                onChange={(val) => setCode(val || "")}
                options={{ minimap: { enabled: false }, fontSize: 13, padding: { top: 20 } }}
            />
{scanError && (
    <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        right: '20px',
        padding: '12px',
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        color: 'white',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: '600',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 100
    }}>
        <span>{scanError}</span>
        <button
            onClick={() => setScanError(null)}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
        >
            ✕
        </button>
    </div>
)}
        </div>

        {/* Visualizer Pane */}
        <div style={{ flex: 1, position: 'relative', backgroundColor: 'var(--bg-deep)' }}>

            {scanError && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(5, 5, 5, 0.8)',
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{ textAlign: 'center', padding: '30px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-dim)' }}>
                        <div style={{ color: 'var(--accent-red)', fontWeight: 'bold', marginBottom: '10px' }}>{scanError}</div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>The backend didn't respond in time.</p>
                        <button className="btn-primary" onClick={handleScan}>
                            TRY AGAIN
                        </button>
                    </div>
                </div>
            )}

            <div style={{
                position: 'absolute',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                pointerEvents: 'none'
            }}>
                <div style={{
                    padding: '8px 24px',
                    backgroundColor: 'var(--bg-panel)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid var(--border-dim)',
                    borderRadius: '99px',
                    boxShadow: 'var(--shadow-soft)',
                }}>
                    <h2 style={{
                        fontSize: '12px',
                        fontWeight: '800',
                        letterSpacing: '2px',
                        color: 'var(--text-main)',
                        textTransform: 'uppercase',
                        margin: 0
                    }}>
                        Infrastructure <span style={{ color: 'var(--accent-blue)' }}>Topology</span>
                    </h2>
                </div>

                {/* Secondary status line */}
                <div style={{
                    marginTop: '8px',
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                }}>
                    Real-time Azure resource visualiser
                </div>
            </div>

            {nodes.length > 0 && (
                <div className="floating-overlay" style={{ top: '20px', left: 'auto', right: '20px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Scan Result</div>
                    <div style={{ fontWeight: 'bold', marginTop: '4px', color: nodes.some(n => n.data.isViolating) ? 'var(--accent-red)' : '#10b981' }}>
                        {nodes.some(n => n.data.isViolating) ? '⚠️ Violations Found' : '✅ Shield Active'}
                    </div>
                </div>
            )}

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={(c) => setNodes((n) => applyNodeChanges(c, n))}
                onEdgesChange={(c) => setEdges((e) => applyEdgeChanges(c, e))}
                nodeTypes={nodeTypes}
                fitView
            >
                <Background
                    variant="dots"
                    color={theme === 'dark' ? '#3f3f46' : '#cbd5e1'}
                    style={{ backgroundColor: 'var(--bg-deep)' }}
                    gap={24}
                    size={1.5}
                />
                <Controls />
            </ReactFlow>
        </div>
    </div>
);

const renderSettings = () => (
    <div className="settings-page-wrapper">
        <header className="settings-header">
            <h2 style={{ fontSize: '36px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                Workspace Settings
            </h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '10px', fontSize: '14px' }}>
                Tailor the visualizer and engine behavior.
            </p>
        </header>

        <div className="settings-content">
            {/* Appearance Section */}
            <section className="settings-section">
                <h3 className="panel-title" style={{ color: 'var(--accent-blue)', marginBottom: '10px' }}>Appearance</h3>
                <div className="setting-row">
                    <div className="setting-label-group">
                        <span className="setting-label">Interface Theme</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Switch between light and dark visual styles.</span>
                    </div>
                    <div className="setting-control">
                        <button className="btn-secondary" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                            Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
                        </button>
                    </div>
                </div>
            </section>

            {/* Scanning Section */}
            <section className="settings-section">
                <h3 className="panel-title" style={{ color: 'var(--accent-blue)', marginBottom: '10px' }}>Scanning Engine</h3>

                <div className="setting-row">
                    <div className="setting-label-group">
                        <span className="setting-label">Enable Auto-scan</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Automatically trigger scans while typing.</span>
                    </div>
                    <div className="setting-control">
                        <div className="toggle-group" style={{ margin: 0, width: '160px' }}>
                            <button
                                className={`toggle-btn ${!isAutoScanEnabled ? 'active' : ''}`}
                                onClick={() => setIsAutoScanEnabled(false)}
                            >
                                Off
                            </button>
                            <button
                                className={`toggle-btn ${isAutoScanEnabled ? 'active' : ''}`}
                                onClick={() => setIsAutoScanEnabled(true)}
                            >
                                On
                            </button>
                        </div>
                    </div>
                </div>

                <div className="setting-row" style={{
                    opacity: isAutoScanEnabled ? 1 : 0.4,
                    pointerEvents: isAutoScanEnabled ? 'auto' : 'none',
                    transition: 'opacity 0.2s ease'
                }}>
                    <div className="setting-label-group">
                        <span className="setting-label">Auto-scan Frequency</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Trigger scan after typing (min: 5 lines).</span>
                    </div>
                    <div className="setting-control">
                        <input
                            type="number"
                            min="5"
                            value={autoScanLineLimit}
                            onChange={(e) => setAutoScanLineLimit(parseInt(e.target.value) || 5)}
                            style={{
                                background: 'var(--bg-deep)',
                                border: '1px solid var(--border-dim)',
                                color: 'var(--text-main)',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                width: '70px',
                                outline: 'none'
                            }}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>Lines</span>
                    </div>
                </div>
            </section>

            {/* Layout Section */}
            <section className="settings-section">
                <h3 className="panel-title" style={{ color: 'var(--accent-blue)', marginBottom: '10px' }}>Visualizer Layout</h3>

                <div className="setting-row">
                    <div className="setting-label-group">
                        <span className="setting-label">Graph Direction</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Set the architectural flow orientation.</span>
                    </div>
                    <div className="setting-control">
                        <div className="toggle-group">
                            <button className={`toggle-btn ${layoutDirection === 'TB' ? 'active' : ''}`} onClick={() => setLayoutDirection('TB')}>Vertical</button>
                            <button className={`toggle-btn ${layoutDirection === 'LR' ? 'active' : ''}`} onClick={() => setLayoutDirection('LR')}>Horizontal</button>
                        </div>
                    </div>
                </div>

                <div className="setting-row">
                    <div className="setting-label-group">
                        <span className="setting-label">Node Spacing</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Adjust the gap between resource nodes.</span>
                    </div>
                    <div className="setting-control">
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '50px' }}>{nodeSpacing}px</span>
                        <input
                            type="range" min="50" max="300" step="10"
                            value={nodeSpacing}
                            onChange={(e) => setNodeSpacing(parseInt(e.target.value))}
                        />
                    </div>
                </div>

                <div className="setting-row">
                    <div className="setting-label-group">
                        <span className="setting-label">Connection Pulse Speed</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Set the flow animation duration.</span>
                    </div>
                    <div className="setting-control">
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '50px' }}>{animationSpeed}s</span>
                        <input
                            type="range" min="0.5" max="5" step="0.5"
                            value={animationSpeed}
                            onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
                        />
                    </div>
                </div>
            </section>
        </div>
    </div>
);

    const rowStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 0',
        borderBottom: '1px solid var(--border-dim)'
    };
    const inputStyle = {
        background: 'var(--bg-deep)',
        border: '1px solid var(--border-dim)',
        color: 'var(--text-main)',
        padding: '4px 8px',
        borderRadius: '4px',
        width: '80px'
    };

    const renderPolicyLab = () => (
    <div className="view-container">
        <div className="panel" style={{ width: '320px' }}>
            <div className="panel-header"><span className="panel-title">Policy Source</span></div>
            <div className="toggle-group">
                <button className={`toggle-btn ${sourceMode === 'ms' ? 'active' : ''}`} onClick={switchToMS}>Azure Auth</button>
                <button className={`toggle-btn ${sourceMode === 'manual' ? 'active' : ''}`} onClick={switchToManual}>Manual</button>
            </div>

            {sourceMode === 'ms' ? (
                <div className="policy-list">
                    {accounts.length === 0 ? (
                        <button className="btn-primary" onClick={handleLogin} style={{ marginTop: '20px' }}>Login to Azure</button>
                    ) : (
                        <>
                            <button className="btn-secondary" onClick={fetchUserPolicies} disabled={isSyncing} style={{ marginBottom: '10px' }}>
                                {isSyncing ? <><span className="spinner"></span>SYNCING...</> : 'Sync Policies'}
                            </button>
                            {importedPolicies.map((p, i) => (
                                <div key={i} className={`policy-card ${selectedPolicyIndex === i ? 'selected' : ''}`}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <input
                                            type="checkbox"
                                            checked={policyStatus[p.displayName] !== false}
                                            onChange={() => togglePolicy(p.displayName)}
                                        />
                                        <span onClick={() => setSelectedPolicyIndex(i)} style={{ flex: 1, cursor: 'pointer' }}>{p.displayName}</span>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            ) : (
                <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.5' }}>
                    <strong>Manual Mode</strong><br/>
                    The editor is now unlocked. Any JSON array pasted here will be used for the next infrastructure scan.
                </div>
            )}
        </div>

        <div className="panel" style={{ flex: 1 }}>
            <div className="panel-header">
                <span className="panel-title">
                    {sourceMode === 'ms' ? `Viewing: ${importedPolicies[selectedPolicyIndex]?.displayName || 'No Policy Selected'}` : 'Manual Policy Editor'}
                </span>
            </div>
            <Editor
                path="policies.json"
                height="calc(100% - 50px)"
                defaultLanguage="json"
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                value={sourceMode === 'ms'
                    ? (importedPolicies.length > 0 ? JSON.stringify(importedPolicies[selectedPolicyIndex], null, 2) : "// No policies synced")
                    : manualPoliciesText
                }
                onChange={(val) => { if(sourceMode === 'manual') setManualPoliciesText(val || ""); }}
                options={{
                    readOnly: sourceMode === 'ms',
                    minimap: { enabled: false },
                    fontSize: 13,
                    padding: { top: 20 },
                    formatOnPaste: true
                }}
            />
        </div>
    </div>
);

return (
    <div className={`app-container theme-${theme}`}>
        <nav className="side-nav">
            <div className="nav-top">
                <div className="nav-logo" style={{
                    padding: '20px 0',
                    display: 'flex',
                    justifyContent: 'center',
                    borderBottom: '1px solid var(--border-dim)',
                    marginBottom: '10px'
                }}>
                    <img
                        src={logoImg}
                        alt="APS Logo"
                        style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                    />
                </div>
                <div className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('dashboard')} title="Dashboard">
                    <LayoutDashboard size={20} />
                </div>
                <div className={`nav-item ${currentView === 'lab' ? 'active' : ''}`} onClick={() => setCurrentView('lab')} title="Policy Lab">
                    <ShieldCheck size={20} />
                </div>
                <div className={`nav-item ${currentView === 'settings' ? 'active' : ''}`} onClick={() => setCurrentView('settings')} title="Settings">
                    <Settings size={20} />
                </div>
            </div>

            <div className="nav-bottom">
                <div className="nav-item" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle Theme">
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </div>

                {accounts.length > 0 && (
                    <div className="nav-item" onClick={handleLogout} title="Logout from Azure" style={{ color: 'var(--accent-red)' }}>
                        <LogOut size={20} /> {/* Using Settings icon as a placeholder logout */}
                    </div>
                )}
            </div>
        </nav>

        {currentView === 'dashboard' && renderDashboard()}
        {currentView === 'lab' && renderPolicyLab()}
        {currentView === 'settings' && renderSettings()}
    </div>
);
}