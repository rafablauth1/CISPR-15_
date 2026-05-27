'use client'

import { useEffect, useState } from 'react'

/**
 * Barra de título customizada — apenas visual (branding).
 *
 * NÃO usa -webkit-app-region: drag nem botões min/max/close custom.
 * Com titleBarStyle:'hidden' + titleBarOverlay no electron/main.js, o Windows
 * (DWM) gerencia drag e botões nativamente, evitando o bug que bloqueia
 * todos os cliques quando frame:false é combinado com webkit-app-region.
 *
 * O TitleBar só aparece no Electron (detecta window.electronAPI).
 */
export function TitleBar() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if ((window as any).electronAPI) setVisible(true)
  }, [])

  if (!visible) return null

  return (
    <div
      className="no-print"
      style={{
        position: 'sticky',
        top: 0,
        width: '100%',
        height: 32,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        background: 'rgba(4, 6, 12, 0.97)',
        borderBottom: '1px solid rgba(255,255,255,0.048)',
        userSelect: 'none',
        /* SEM WebkitAppRegion — Windows DWM cuida do drag via titleBarOverlay */
      } as React.CSSProperties}
    >
      {/* ── Identidade (esquerda) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 14 }}>

        {/* Mini logo quadrado */}
        <div style={{
          width: 14, height: 14,
          borderRadius: 3,
          background: 'rgba(var(--accent-rgb,232,185,75),0.18)',
          border: '1px solid rgba(var(--accent-rgb,232,185,75),0.30)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <div style={{
            width: 5, height: 5,
            borderRadius: 1,
            background: 'rgba(var(--accent-rgb,232,185,75),0.80)',
          }} />
        </div>

        <span style={{
          fontFamily: 'var(--font-syne, system-ui)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.13em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.28)',
        }}>
          LABELO
        </span>

        <span style={{
          width: 1, height: 10,
          background: 'rgba(255,255,255,0.08)',
          display: 'block', flexShrink: 0,
        }} />

        <span style={{
          fontFamily: 'var(--font-dm-mono, monospace)',
          fontSize: 9.5,
          letterSpacing: '0.05em',
          color: 'rgba(var(--accent-rgb,232,185,75),0.52)',
        }}>
          CISPR 15
        </span>
      </div>

      {/* ── Texto central sutil ── */}
      <div style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        fontFamily: 'var(--font-dm-mono, monospace)',
        fontSize: 8.5,
        letterSpacing: '0.22em',
        color: 'rgba(255,255,255,0.06)',
        textTransform: 'uppercase',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}>
        PUCRS · EMC LAB
      </div>

      {/* Área direita vazia — reservada para os botões nativos do titleBarOverlay */}
    </div>
  )
}
