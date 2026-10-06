'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Archive, BarChart3, Check, ChevronDown, CircleStop, Clock3,
  Copy, FileText, Flag, Headphones, Mic, Pause, Play, Plus, Search,
  Settings2, Shield, Sparkles, SquarePen, Target, Trash2, Trophy,
  Upload, Volume2, X, Zap
} from 'lucide-react';

type Category = 'Geral' | 'Ofensivo' | 'Defensivo' | 'Transição Ofensiva' | 'Transição Defensiva' | 'Bolas Paradas' | 'Individual';
type MatchStatus = 'Preparação' | 'Ao Vivo' | 'Finalizado';

type Note = {
  id: string;
  title: string;
  text: string;
  category: Category;
  tags: string[];
  created: string;
  updated: string;
  audioId?: string;
  duration?: number;
  matchId?: string;
};

type Match = {
  id: string;
  opponent: string;
  competition: string;
  date: string;
  status: MatchStatus;
  notes: string[];
};

const NOTES_KEY = 'notecoach_notes_v20';
const MATCHES_KEY = 'notecoach_matches_v20';
const AUDIO_DB = 'notecoach_audio_v20';

const categories: Category[] = [
  'Geral', 'Ofensivo', 'Defensivo', 'Transição Ofensiva',
  'Transição Defensiva', 'Bolas Paradas', 'Individual'
];

const quickActions = [
  { label: 'Golo', icon: Trophy, category: 'Ofensivo' as Category },
  { label: 'Remate', icon: Target, category: 'Ofensivo' as Category },
  { label: 'Assistência', icon: Zap, category: 'Ofensivo' as Category },
  { label: 'Recuperação', icon: Shield, category: 'Defensivo' as Category },
  { label: 'Perda de bola', icon: Activity, category: 'Transição Defensiva' as Category },
  { label: 'Bola parada', icon: Flag, category: 'Bolas Paradas' as Category },
];

function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function openAudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUDIO_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveAudio(id: string, blob: Blob) {
  const db = await openAudioDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('recordings', 'readwrite');
    tx.objectStore('recordings').put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAudio(id: string) {
  const db = await openAudioDB();
  return new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction('recordings', 'readonly');
    const req = tx.objectStore('recordings').get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteAudio(id: string) {
  const db = await openAudioDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('recordings', 'readwrite');
    tx.objectStore('recordings').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'notes' | 'match' | 'report' | 'ai'>('notes');
  const [aiMode, setAiMode] = useState<'jogo' | 'treino' | 'individual'>('jogo');
  const [aiPrompt, setAiPrompt] = useState('Analisa as minhas observações e identifica os 3 principais problemas, as possíveis causas e três exercícios para os corrigir.');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'Todas'>('Todas');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [opponent, setOpponent] = useState('');
  const [competition, setCompetition] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [status, setStatus] = useState<MatchStatus>('Preparação');
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [report, setReport] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState('');
  const [isMobileMenu, setIsMobileMenu] = useState(false);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognition = useRef<any>(null);

  const selected = notes.find(n => n.id === selectedId) || null;
  const activeMatch = matches.find(m => m.id === matchId) || null;

  useEffect(() => {
    try {
      setNotes(JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'));
      setMatches(JSON.parse(localStorage.getItem(MATCHES_KEY) || '[]'));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(MATCHES_KEY, JSON.stringify(matches));
  }, [matches]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (recording && !paused) {
      timer.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [recording, paused]);

  const filteredNotes = useMemo(() => {
    const q = search.toLowerCase().trim();
    return notes
      .filter(n => category === 'Todas' || n.category === category)
      .filter(n => !q || `${n.title} ${n.text} ${n.tags.join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => b.updated.localeCompare(a.updated));
  }, [notes, search, category]);

  function newNote(category: Category = 'Geral', text = '') {
    const now = new Date().toISOString();
    const note: Note = {
      id: uid('note'),
      title: 'Nova nota',
      text,
      category,
      tags: [],
      created: now,
      updated: now,
      matchId: matchId || undefined
    };
    setNotes(prev => [note, ...prev]);
    setSelectedId(note.id);
    setView('notes');
    setToast('Nota criada');
  }

  function updateSelected(patch: Partial<Note>) {
    if (!selectedId) return;
    setNotes(prev => prev.map(n => n.id === selectedId ? { ...n, ...patch, updated: new Date().toISOString() } : n));
  }

  async function removeNote(id: string) {
    const n = notes.find(x => x.id === id);
    if (n?.audioId) await deleteAudio(n.audioId).catch(() => {});
    setNotes(prev => prev.filter(x => x.id !== id));
    if (selectedId === id) setSelectedId(null);
    setToast('Nota eliminada');
  }

  function createMatch() {
    if (!opponent.trim()) return;
    const m: Match = {
      id: uid('match'),
      opponent: opponent.trim(),
      competition: competition.trim() || 'Jogo',
      date: matchDate || new Date().toISOString().slice(0, 10),
      status,
      notes: []
    };
    setMatches(prev => [m, ...prev]);
    setMatchId(m.id);
    setMatchOpen(false);
    setOpponent('');
    setCompetition('');
    setMatchDate('');
    setView('match');
    setToast('Jogo criado');
  }

  function addQuickAction(label: string, cat: Category) {
    const time = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    newNote(cat, `[${time}] ${label}`);
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setToast('O navegador não suporta gravação de áudio');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const rec = new MediaRecorder(stream);
      mediaRecorder.current = rec;
      rec.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
        const audioId = uid('audio');
        await saveAudio(audioId, blob);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(blob));
        updateSelected({ audioId, duration: seconds });
        setToast('Gravação guardada');
      };
      rec.start();
      setSeconds(0);
      setRecording(true);
      setPaused(false);
    } catch {
      setToast('Não foi possível aceder ao microfone');
    }
  }

  function stopRecording() {
    mediaRecorder.current?.stop();
    setRecording(false);
    setPaused(false);
  }

  function togglePause() {
    const r = mediaRecorder.current;
    if (!r) return;
    if (r.state === 'recording') { r.pause(); setPaused(true); }
    else if (r.state === 'paused') { r.resume(); setPaused(false); }
  }

  async function loadAudio(note: Note) {
    if (!note.audioId) return;
    const blob = await getAudio(note.audioId);
    if (!blob) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(blob));
  }

  function toggleSpeech() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setToast('Transcrição do navegador não está disponível neste browser');
      return;
    }
    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }
    const r = new SR();
    recognition.current = r;
    r.lang = 'pt-PT';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (event: any) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript + ' ';
      }
      if (finalText) {
        setTranscript(t => `${t} ${finalText}`.trim());
      }
    };
    r.onend = () => setListening(false);
    r.start();
    setListening(true);
    setToast('Transcrição ativa');
  }

  function copyTranscript() {
    if (!transcript) return;
    updateSelected({ text: `${selected?.text || ''}\n\n${transcript}`.trim() });
    setToast('Transcrição adicionada à nota');
  }

  function generateReport() {
    const source = activeMatch
      ? notes.filter(n => n.matchId === activeMatch.id || !n.matchId)
      : notes;
    const groups = categories.map(cat => ({
      cat,
      items: source.filter(n => n.category === cat && n.text.trim())
    })).filter(g => g.items.length);

    let text = activeMatch
      ? `RELATÓRIO DE JOGO\n${activeMatch.opponent} — ${activeMatch.competition}\nData: ${activeMatch.date}\n\n`
      : `RELATÓRIO DE ANÁLISE\nData: ${new Date().toLocaleDateString('pt-PT')}\n\n`;

    for (const group of groups) {
      text += `## ${group.cat}\n`;
      group.items.forEach(n => { text += `• ${n.text.replace(/\n/g, ' ')}\n`; });
      text += '\n';
    }

    if (!groups.length) text += 'Sem informação suficiente para gerar o relatório.\n';
    text += '\n---\nNOTA: Esta é uma organização automática das notas. A próxima versão poderá usar IA para transformar o conteúdo em análise técnica completa.';
    setReport(text);
    setView('report');
  }

  async function runAIAnalysis() {
    setAiLoading(true);
    setAiResult('');
    try {
      const sourceNotes = activeMatch
        ? notes.filter(n => n.matchId === activeMatch.id || !n.matchId)
        : notes;
      const noteText = sourceNotes
        .filter(n => n.text.trim())
        .map(n => `[${n.category}] ${n.title}: ${n.text}${n.tags.length ? ` | Tags: ${n.tags.join(', ')}` : ''}`)
        .join('\n');

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: aiMode,
          opponent: activeMatch?.opponent || '',
          competition: activeMatch?.competition || '',
          notes: noteText || '(sem notas registadas)',
          prompt: aiPrompt
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Não foi possível obter a análise.');
      setAiResult(data.result || 'A IA não devolveu conteúdo.');
    } catch (error: any) {
      setAiResult(`ERRO NA ANÁLISE\n\n${error?.message || 'Ocorreu um erro inesperado.'}`);
    } finally {
      setAiLoading(false);
    }
  }

  function exportReport() {
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NOTECOACH-relatorio-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const noteCount = notes.length;
  const audioCount = notes.filter(n => n.audioId).length;
  const matchCount = matches.length;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark"><Headphones size={21}/></div>
          <div><strong>NOTECOACH</strong><span>FOOTBALL NOTES • 2.0</span></div>
        </div>
        <div className="topActions">
          <button className="iconBtn" onClick={() => setShowSettings(v => !v)} title="Definições"><Settings2 size={19}/></button>
          <button className="primary" onClick={() => newNote()}><Plus size={18}/> Nova nota</button>
        </div>
      </header>

      <div className="layout">
        <aside className={`sidebar ${isMobileMenu ? 'mobileOpen' : ''}`}>
          <nav>
            <button className={view === 'notes' ? 'nav active' : 'nav'} onClick={() => { setView('notes'); setIsMobileMenu(false); }}><FileText size={18}/> Notas <b>{noteCount}</b></button>
            <button className={view === 'match' ? 'nav active' : 'nav'} onClick={() => { setView('match'); setIsMobileMenu(false); }}><Activity size={18}/> Match Mode <b>{matchCount}</b></button>
            <button className={view === 'report' ? 'nav active' : 'nav'} onClick={() => { if (!report) generateReport(); else setView('report'); setIsMobileMenu(false); }}><BarChart3 size={18}/> Relatórios</button>
            <button className={view === 'ai' ? 'nav active' : 'nav'} onClick={() => { setView('ai'); setIsMobileMenu(false); }}><Sparkles size={18}/> AI Analyst <b>PRO</b></button>
          </nav>

          <div className="sideSection">
            <div className="sideTitle">Categorias</div>
            {categories.map(c => <button key={c} className={`category ${category === c ? 'selected' : ''}`} onClick={() => { setCategory(c); setView('notes'); }}><span className="dot"/>{c}</button>)}
          </div>

          <div className="sideBottom">
            <div className="miniStat"><Mic size={16}/><span>Áudios</span><b>{audioCount}</b></div>
            <div className="miniStat"><Clock3 size={16}/><span>Local</span><b>OFFLINE</b></div>
          </div>
        </aside>

        <section className="content">
          <button className="mobileMenu" onClick={() => setIsMobileMenu(v => !v)}>☰ Menu</button>

          {view === 'notes' && (
            <>
              <div className="pageHead">
                <div><p className="eyebrow">CENTRO DE NOTAS</p><h1>As tuas ideias. O teu jogo.</h1><p className="muted">Escreve, grava, transcreve e organiza tudo num só lugar.</p></div>
                <div className="stats"><div><b>{noteCount}</b><span>Notas</span></div><div><b>{audioCount}</b><span>Áudios</span></div></div>
              </div>

              <div className="searchRow">
                <div className="search"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar notas, ações ou etiquetas..." /></div>
                <select value={category} onChange={e => setCategory(e.target.value as any)}><option>Todas</option>{categories.map(c => <option key={c}>{c}</option>)}</select>
              </div>

              <div className="notesGrid">
                {filteredNotes.length === 0 ? (
                  <div className="empty"><SquarePen size={34}/><h2>Começa uma nova nota</h2><p>Regista uma ideia, uma observação de treino ou uma situação de jogo.</p><button className="primary" onClick={() => newNote()}><Plus size={17}/> Criar nota</button></div>
                ) : filteredNotes.map(note => (
                  <article key={note.id} className={`noteCard ${selectedId === note.id ? 'selected' : ''}`} onClick={() => { setSelectedId(note.id); loadAudio(note); }}>
                    <div className="cardTop"><span className={`pill ${note.category.replaceAll(' ', '-').toLowerCase()}`}>{note.category}</span><span>{formatDate(note.updated)}</span></div>
                    <h3>{note.title}</h3>
                    <p>{note.text || 'Sem conteúdo ainda...'}</p>
                    <div className="cardFoot">{note.audioId && <span><Headphones size={14}/> Áudio</span>} {note.tags.map(t => <span key={t}>#{t}</span>)}<button onClick={e => {e.stopPropagation(); removeNote(note.id)}}><Trash2 size={15}/></button></div>
                  </article>
                ))}
              </div>
            </>
          )}

          {view === 'match' && (
            <div className="matchPage">
              <div className="pageHead"><div><p className="eyebrow">MATCH MODE</p><h1>Analisa enquanto o jogo acontece. ⚽</h1><p className="muted">Ações rápidas, notas por momento e áudio sem perder tempo.</p></div><button className="primary" onClick={() => setMatchOpen(true)}><Plus size={18}/> Novo jogo</button></div>

              {!activeMatch ? (
                <div className="empty large"><Activity size={40}/><h2>Nenhum jogo selecionado</h2><p>Cria um jogo para começar a análise em direto.</p><button className="primary" onClick={() => setMatchOpen(true)}><Plus size={17}/> Criar jogo</button></div>
              ) : (
                <>
                  <div className="matchBanner">
                    <div><span className="eyebrow">JOGO ATIVO</span><h2>{activeMatch.opponent}</h2><p>{activeMatch.competition} · {activeMatch.date}</p></div>
                    <select value={activeMatch.status} onChange={e => setMatches(ms => ms.map(m => m.id === activeMatch.id ? {...m, status: e.target.value as MatchStatus} : m))}>{(['Preparação','Ao Vivo','Finalizado'] as MatchStatus[]).map(s => <option key={s}>{s}</option>)}</select>
                  </div>

                  <div className="quickGrid">
                    {quickActions.map(a => <button key={a.label} onClick={() => addQuickAction(a.label, a.category)}><a.icon size={22}/><span>{a.label}</span></button>)}
                  </div>

                  <div className="liveArea">
                    <div className="liveCard">
                      <div className="liveHead"><span><span className="liveDot"/> GRAVAÇÃO</span><strong>{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</strong></div>
                      <div className="recordCircle">{recording ? <CircleStop size={38}/> : <Mic size={38}/>}</div>
                      <p>{recording ? (paused ? 'Gravação em pausa' : 'A gravar o momento...') : 'Grava uma observação técnica'}</p>
                      <div className="recordActions">{!recording ? <button className="primary round" onClick={startRecording}><Mic size={18}/> Gravar</button> : <><button className="secondary" onClick={togglePause}>{paused ? <Play size={17}/> : <Pause size={17}/>} {paused ? 'Retomar' : 'Pausa'}</button><button className="danger" onClick={stopRecording}><CircleStop size={17}/> Parar</button></>}</div>
                      {audioUrl && <audio controls src={audioUrl}/>}
                    </div>

                    <div className="liveCard transcriptCard">
                      <div className="liveHead"><span><Sparkles size={17}/> TRANSCRIÇÃO</span><button className={listening ? 'danger small' : 'secondary small'} onClick={toggleSpeech}>{listening ? 'Parar' : 'Iniciar voz'}</button></div>
                      <textarea value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Fala e a transcrição aparecerá aqui..." />
                      <button className="secondary full" onClick={copyTranscript} disabled={!selected}>Adicionar à nota selecionada</button>
                    </div>
                  </div>
                </>
              )}

              <div className="matchList">
                <h3>Jogos</h3>
                {matches.map(m => <button key={m.id} className={m.id === matchId ? 'matchItem selected' : 'matchItem'} onClick={() => {setMatchId(m.id); setView('match')}}><div><b>{m.opponent}</b><span>{m.competition} · {m.date}</span></div><span className="status">{m.status}</span></button>)}
              </div>
            </div>
          )}

          {view === 'report' && (
            <div className="reportPage">
              <div className="pageHead"><div><p className="eyebrow">RELATÓRIO</p><h1>Transforma notas em estrutura.</h1><p className="muted">Organização automática por áreas do jogo.</p></div><div className="row"><button className="secondary" onClick={generateReport}><Sparkles size={17}/> Gerar novamente</button><button className="primary" onClick={exportReport}><Upload size={17}/> Exportar</button></div></div>
              <div className="reportPaper"><pre>{report || 'Ainda não existe relatório. Clica em “Gerar novamente”.'}</pre></div>
            </div>
          )}
          {view === 'ai' && (
            <div className="aiPage">
              <div className="pageHead">
                <div><p className="eyebrow">INTELIGÊNCIA ARTIFICIAL</p><h1>AI Analyst</h1><p className="muted">Transforma as tuas notas em análise técnica e ações práticas.</p></div>
                <div className="aiBadge"><Sparkles size={15}/> IA DISPONÍVEL</div>
              </div>

              <div className="aiLayout">
                <div className="aiInputCard">
                  <div className="aiCardHead"><div><b>Configurar análise</b><span>Escolhe o contexto e diz à IA o que queres descobrir.</span></div></div>
                  <div className="modeGrid">
                    {[['jogo','Análise de Jogo','Padrões, problemas e prioridades do jogo'],['treino','Análise de Treino','Qualidade do treino e comportamentos a desenvolver'],['individual','Análise Individual','Leitura técnica e comportamental da jogadora']].map(([id,title,desc]) => (
                      <button key={id} className={aiMode === id ? 'modeBtn active' : 'modeBtn'} onClick={() => setAiMode(id as any)}><b>{title}</b><span>{desc}</span></button>
                    ))}
                  </div>

                  <div className="aiContext"><b>FONTE DA ANÁLISE</b><span>{activeMatch ? `${activeMatch.opponent} · ${activeMatch.competition}` : `${notes.length} notas disponíveis`}</span></div>

                  <div className="aiPrompt"><label>O QUE QUERES QUE A IA ANALISE?</label><textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} /></div>

                  <div className="aiSource"><div><b>{notes.length}</b><span>NOTAS</span></div><div><b>{audioCount}</b><span>ÁUDIOS</span></div><div><b>{activeMatch ? 'JOGO' : 'GERAL'}</b><span>CONTEXTO</span></div></div>

                  <button className="primary aiRun" onClick={runAIAnalysis} disabled={aiLoading}>
                    <Sparkles size={17}/> {aiLoading ? 'A analisar...' : 'Analisar com IA'}
                  </button>
                </div>

                <div className="aiResultCard">
                  <div className="aiCardHead"><div><b>Resultado da análise</b><span>Resposta gerada a partir das tuas observações.</span></div></div>
                  <div className={aiLoading ? 'aiResult loading' : 'aiResult'}>
                    {aiResult ? <pre>{aiResult}</pre> : <><Sparkles size={34}/><h3>Pronto para analisar</h3><p>Regista algumas notas e carrega em “Analisar com IA”. A IA vai organizar padrões, problemas, causas e exercícios.</p></>}
                  </div>
                  <div className="aiIdeas"><b>EXEMPLOS:</b><button onClick={() => setAiPrompt('Identifica os 3 principais problemas da equipa, explica as possíveis causas e propõe 3 exercícios específicos para os corrigir.')}>3 problemas + exercícios</button><button onClick={() => setAiPrompt('Analisa os padrões ofensivos e defensivos e indica o que devemos manter, corrigir e treinar no próximo microciclo.')}>Plano para o próximo treino</button></div>
                </div>
              </div>
            </div>
          )}
        </section>

        {selected && view === 'notes' && (
          <aside className="editor">
            <div className="editorHead"><div><span className="eyebrow">EDITOR</span><h2>Nota</h2></div><button className="iconBtn" onClick={() => setSelectedId(null)}><X size={18}/></button></div>
            <input className="titleInput" value={selected.title} onChange={e => updateSelected({title: e.target.value})}/>
            <select value={selected.category} onChange={e => updateSelected({category: e.target.value as Category})}>{categories.map(c => <option key={c}>{c}</option>)}</select>
            <textarea className="noteEditor" value={selected.text} onChange={e => updateSelected({text: e.target.value})} placeholder="Escreve aqui a tua observação..."/>
            <div className="tagBox"><label>Etiquetas</label><input placeholder="ex.: construção, pressão, 2.º poste" onKeyDown={e => {if(e.key === 'Enter' && e.currentTarget.value.trim()){updateSelected({tags:[...selected.tags,e.currentTarget.value.trim()]}); e.currentTarget.value=''}}}/><div className="tags">{selected.tags.map(t => <span key={t}>#{t}<button onClick={() => updateSelected({tags:selected.tags.filter(x=>x!==t)})}>×</button></span>)}</div></div>
            <div className="editorActions">
              <button className="secondary" onClick={selected.audioId ? () => loadAudio(selected) : startRecording}><Mic size={17}/> {selected.audioId ? 'Ouvir áudio' : 'Gravar áudio'}</button>
              <button className="secondary" onClick={toggleSpeech}><Sparkles size={17}/> Voz → texto</button>
            </div>
            {audioUrl && <audio controls src={audioUrl}/>}
            <div className="editorFooter"><span>Guardado automaticamente</span><button className="dangerGhost" onClick={() => removeNote(selected.id)}><Trash2 size={16}/> Eliminar</button></div>
          </aside>
        )}
      </div>

      {showSettings && <div className="settings"><div className="settingsTitle"><Settings2 size={18}/> Definições <button onClick={() => setShowSettings(false)}><X size={17}/></button></div><p>Os dados desta versão ficam guardados localmente no dispositivo.</p><div className="settingRow"><span>Modo offline</span><b>ATIVO</b></div><div className="settingRow"><span>Versão</span><b>2.0</b></div></div>}

      {matchOpen && <div className="modalBack"><div className="modal"><div className="modalHead"><h2>Novo jogo</h2><button onClick={() => setMatchOpen(false)}><X/></button></div><label>Adversário<input autoFocus value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="Ex.: Benfica"/></label><label>Competição<input value={competition} onChange={e => setCompetition(e.target.value)} placeholder="Ex.: Campeonato Nacional"/></label><label>Data<input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)}/></label><label>Estado<select value={status} onChange={e => setStatus(e.target.value as MatchStatus)}><option>Preparação</option><option>Ao Vivo</option><option>Finalizado</option></select></label><button className="primary full" onClick={createMatch}><Check size={18}/> Criar jogo</button></div></div>}

      {toast && <div className="toast"><Check size={16}/>{toast}</div>}
    </main>
  );
}
