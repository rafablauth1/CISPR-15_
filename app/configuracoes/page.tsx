'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Settings, FolderOpen, FileSpreadsheet,
  CheckCircle2, AlertTriangle, Save, RotateCcw, Lock, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { type AppSettings, SETTINGS_DEFAULTS, SETTINGS_KEY, AUTH_KEY } from '@/app/cispr15/types'

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] text-white/35 uppercase tracking-widest font-mono">{children}</label>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 space-y-4">
      <p className="form-section">{title}</p>
      {children}
    </div>
  )
}

export default function ConfiguracoesPage() {
  const router = useRouter()
  const [settings,     setSettings]     = useState<AppSettings>(SETTINGS_DEFAULTS)
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [isElectron,   setIsElectron]   = useState(false)
  const [localDataDir, setLocalDataDir] = useState<string | null>(null)
  const [gateOpen,     setGateOpen]     = useState(false)
  const [gateInput,    setGateInput]    = useState('')
  const [gateError,    setGateError]    = useState(false)
  const [appPassword,  setAppPassword]  = useState('')

  useEffect(() => {
    const api = (window as any).electronAPI
    if (api) {
      setIsElectron(true)
      api.getSettings().then((s: AppSettings) => {
        setSettings(s)
        const senha = s.senhaEmissao ?? ''
        setAppPassword(senha)
        if (senha) setGateOpen(true)
      })
      api.getLocalDataDir?.().then((d: string) => setLocalDataDir(d))
    } else {
      try {
        const raw = localStorage.getItem(SETTINGS_KEY)
        if (raw) {
          const s = { ...SETTINGS_DEFAULTS, ...JSON.parse(raw) }
          setSettings(s)
          const senha = s.senhaEmissao ?? ''
          setAppPassword(senha)
          if (senha) setGateOpen(true)
        }
      } catch {}
    }
  }, [])

  async function salvar() {
    setError(null)
    try {
      const api = (window as any).electronAPI
      if (api) {
        const res = await api.setSettings(settings)
        if (!res.ok) throw new Error(res.error)
      } else {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function browseExcel() {
    const api = (window as any).electronAPI
    if (!api) return
    const res = await api.browseExcel()
    if (!res.canceled) setSettings(s => ({ ...s, excelPath: res.filePath }))
  }

  async function browseDataFolder() {
    const api = (window as any).electronAPI
    if (!api) return
    const res = await api.browseFolder('Selecionar pasta de dados compartilhados (rede)')
    if (!res.canceled) setSettings(s => ({ ...s, dataFolder: res.folderPath }))
  }

  async function browseAgendaFolder() {
    const api = (window as any).electronAPI
    if (!api) return
    const res = await api.browseFolder('Selecionar pasta da Agenda de Execução')
    if (!res.canceled) setSettings(s => ({ ...s, agendaFolder: res.folderPath }))
  }

  async function browsePdfCopyFolder() {
    const api = (window as any).electronAPI
    if (!api) return
    const res = await api.browseFolder('Selecionar pasta de cópias de PDF')
    if (!res.canceled) setSettings(s => ({ ...s, pdfCopyFolder: res.folderPath }))
  }

  function restaurarPadroes() {
    if (!confirm('Restaurar todas as configurações para os valores padrão?')) return
    setSettings(SETTINGS_DEFAULTS)
  }

  return (
    <>
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm mb-8 transition-colors">
        <ArrowLeft size={14} /> Voltar
      </button>

      <div className="mb-8 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 mt-0.5">
          <Settings size={18} className="text-gold" />
        </div>
        <div>
          <p className="text-[11px] text-white/30 font-mono uppercase tracking-widest mb-0.5">
            LABELO · PUCRS
          </p>
          <h1 className="text-2xl font-display font-bold text-white">Configurações</h1>
          <p className="text-white/40 text-sm mt-1">
            Caminhos de arquivos e preferências do aplicativo
          </p>
        </div>
      </div>

      <div className="space-y-4">

        {/* Planilha Excel */}
        <Section title="Planilha de Registro">
          <div className="space-y-2">
            <Label>Caminho da planilha Excel (certificados)</Label>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm font-mono"
                value={settings.excelPath}
                onChange={e => setSettings(s => ({ ...s, excelPath: e.target.value }))}
                placeholder="Ex: \\servidor\projetos\Compatibilidade eletromagnética_2026.xlsx"
              />
              {isElectron && (
                <button type="button" onClick={browseExcel}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/50 hover:text-gold hover:border-gold/30 transition-all text-xs shrink-0">
                  <FileSpreadsheet size={13} /> Procurar
                </button>
              )}
            </div>
            <p className="text-[10px] text-white/25 font-mono">
              Planilha onde os números de relatório são registrados automaticamente ao gerar.
              Pode estar em uma pasta de rede.
            </p>
          </div>
        </Section>

        {/* Pasta de dados compartilhados */}
        <Section title="Pasta de Dados Compartilhados">
          <div className="space-y-2">
            <Label>Pasta de rede (clientes e relatórios)</Label>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm font-mono"
                value={settings.dataFolder}
                onChange={e => setSettings(s => ({ ...s, dataFolder: e.target.value }))}
                placeholder="Ex: \\servidor\projetos\CISPR15\dados"
              />
              {isElectron && (
                <button type="button" onClick={browseDataFolder}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/50 hover:text-teal hover:border-teal/30 transition-all text-xs shrink-0">
                  <FolderOpen size={13} /> Procurar
                </button>
              )}
            </div>
            <p className="text-[10px] text-white/25 font-mono">
              Pasta compartilhada onde <span className="text-white/40">cispr15_clientes.json</span> e{' '}
              <span className="text-white/40">cispr15_relatorios.json</span> são armazenados.
              Qualquer PC na rede com acesso a esta pasta verá os mesmos dados.
              Se vazio, os dados ficam somente neste computador (localStorage).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 text-[11px]">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal/6 border border-teal/15">
              <FolderOpen size={11} className="text-teal shrink-0" />
              <span className="text-teal/80 font-mono truncate">
                {settings.dataFolder || localDataDir || '—'}
              </span>
              {!settings.dataFolder && (
                <span className="ml-auto shrink-0 text-[9px] text-white/25 font-mono uppercase tracking-widest">local</span>
              )}
            </div>
            <div className="flex gap-4 text-white/30 font-mono px-1">
              <span>→ cispr15_clientes.json</span>
              <span>→ cispr15_relatorios.json</span>
            </div>
          </div>
        </Section>

        {/* Pasta da Agenda */}
        <Section title="Pasta da Agenda de Execução">
          <div className="space-y-2">
            <Label>Pasta da agenda <span className="normal-case text-white/20">(separada dos dados gerais)</span></Label>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm font-mono"
                value={settings.agendaFolder ?? ''}
                onChange={e => setSettings(s => ({ ...s, agendaFolder: e.target.value }))}
                placeholder="Ex: \\servidor\projetos\CISPR15\agenda"
              />
              {isElectron && (
                <button type="button" onClick={browseAgendaFolder}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/50 hover:text-teal hover:border-teal/30 transition-all text-xs shrink-0">
                  <FolderOpen size={13} /> Procurar
                </button>
              )}
            </div>
            <p className="text-[10px] text-white/25 font-mono">
              Pasta onde <span className="text-white/40">cispr15_agenda.json</span> será armazenado.
              Se vazio, usa a mesma pasta de dados compartilhados acima (ou a pasta local padrão).
              Técnicos que apenas consultam podem ter acesso somente a esta pasta.
            </p>
          </div>
          {!settings.agendaFolder && !settings.dataFolder && localDataDir && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/4 border border-white/8 text-[11px]">
              <FolderOpen size={11} className="text-white/30 shrink-0" />
              <span className="text-white/40 font-mono truncate">{localDataDir}</span>
              <span className="ml-auto shrink-0 text-[9px] text-white/25 font-mono uppercase tracking-widest">local</span>
            </div>
          )}
        </Section>

        {/* Pasta de cópias de PDF */}
        <Section title="Pasta de Cópias de PDF">
          <div className="space-y-2">
            <Label>Pasta de destino para cópias dos PDFs gerados</Label>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm font-mono"
                value={settings.pdfCopyFolder ?? ''}
                onChange={e => setSettings(s => ({ ...s, pdfCopyFolder: e.target.value }))}
                placeholder="Ex: \\servidor\projetos\CISPR15\relatorios_pdf"
              />
              {isElectron && (
                <button type="button" onClick={browsePdfCopyFolder}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/50 hover:text-teal hover:border-teal/30 transition-all text-xs shrink-0">
                  <FolderOpen size={13} /> Procurar
                </button>
              )}
            </div>
            <p className="text-[10px] text-white/25 font-mono">
              Toda vez que um PDF for gerado ou atualizado (inclusive com assinatura), uma cópia é salva aqui automaticamente.
              Ao excluir um item da agenda, a cópia correspondente também é removida.
              Ideal para acesso de consulta sem expor a pasta original da EUT.
            </p>
          </div>
        </Section>

        {/* PDF / HTML */}
        <Section title="Saída de PDF e HTML">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={settings.pdfAutoSaveToEut}
              onChange={e => setSettings(s => ({ ...s, pdfAutoSaveToEut: e.target.checked }))}
              className="w-4 h-4 rounded accent-gold cursor-pointer"
            />
            <div>
              <p className="text-sm text-white/80 group-hover:text-white transition-colors">
                Salvar PDF automaticamente na pasta da EUT
              </p>
              <p className="text-[10px] text-white/30 font-mono mt-0.5">
                Ao gerar o relatório, um PDF é salvo na mesma pasta do .docx e das fotos
              </p>
            </div>
          </label>
        </Section>

        {/* Segurança */}
        <Section title="Segurança — Emissão de Relatórios">
          <div className="space-y-2">
            <Label>Senha de acesso à emissão</Label>
            <div className="flex gap-2 items-center">
              <Lock size={13} className="text-white/25 shrink-0" />
              <input
                type="password"
                className="input flex-1"
                value={settings.senhaEmissao ?? ''}
                onChange={e => setSettings(s => ({ ...s, senhaEmissao: e.target.value }))}
                placeholder="Vazio = sem senha (livre para todos)"
                autoComplete="new-password"
              />
            </div>
            <p className="text-[10px] text-white/25 font-mono">
              Se preenchida, a área de emissão de relatórios exigirá esta senha a cada sessão.
              A Agenda de Execução é sempre acessível sem senha.
            </p>
          </div>
        </Section>

        {!isElectron && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-amber-400 text-[11px]">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <span>
              Alguns recursos (selecionar arquivo, navegar em pastas de rede) só estão disponíveis
              no aplicativo Electron. No navegador, insira os caminhos manualmente.
            </span>
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center gap-3 pt-2">
          <button type="button" onClick={restaurarPadroes}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 text-white/40 hover:text-white/70 text-sm transition-all">
            <RotateCcw size={13} /> Restaurar padrões
          </button>
          <div className="flex-1" />
          <button type="button" onClick={salvar}
            className="btn-primary flex items-center gap-2 px-6 py-2.5 text-sm font-bold">
            <Save size={14} /> Salvar configurações
          </button>
        </div>

        {saved && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green/10 border border-green/20 text-green-400 text-sm animate-fade-in">
            <CheckCircle2 size={15} /> Configurações salvas com sucesso
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

      </div>
    </div>

    {/* ── Gate de senha ── */}

    {gateOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="card w-full max-w-sm mx-4 p-7 space-y-5 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gold/12 border border-gold/25 flex items-center justify-center">
              <Lock size={20} className="text-gold" />
            </div>
            <div>
              <p className="font-bold text-white">Configurações</p>
              <p className="text-[11px] text-white/40">Informe a senha para acessar</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/35 uppercase tracking-widest font-mono">Senha</label>
            <input
              type="password"
              className={cn('input', gateError && 'border-red-500/50')}
              placeholder="••••••"
              value={gateInput}
              autoFocus
              onChange={e => { setGateInput(e.target.value); setGateError(false) }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (gateInput === appPassword) {
                    setGateOpen(false); setGateInput('')
                  } else { setGateError(true); setGateInput('') }
                }
              }}
            />
            {gateError && <p className="text-[11px] text-red-400">Senha incorreta.</p>}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => router.back()}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 hover:text-white/70 text-sm transition-all">
              Voltar
            </button>
            <button
              type="button"
              onClick={() => {
                if (gateInput === appPassword) {
                  setGateOpen(false); setGateInput('')
                } else { setGateError(true); setGateInput('') }
              }}
              className="btn-primary flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-2">
              <ArrowRight size={14} /> Entrar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
