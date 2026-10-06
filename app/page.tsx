'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, BarChart3, Check, CircleStop, Clock3, FileText,
  Headphones, Mic, Pause, Play, Plus, Search, Settings2, Sparkles,
  SquarePen, Trash2, Upload, Download, X
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
  const [view, setView] = useState<'notes' | 'match' | 'report'>('notes');
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
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const recordingNoteId = useRef<string | null>(null);

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
    if (typeof window === 'undefined') return;
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const onInstalled = () => { setInstallPrompt(null); setIsStandalone(true); setToast('NOTECOACH instalado'); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) {
      setToast('No Android/Chrome: usa o menu ⋮ e escolhe “Instalar aplicação” ou “Adicionar ao ecrã inicial”.');
      return;
    }
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } finally {
      setInstallPrompt(null);
    }
  }

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
      title: matchId ? 'Nova observação' : 'Nova nota',
      text,
      category,
      tags: [],
      created: now,
      updated: now,
      matchId: matchId || undefined
    };
    setNotes(prev => [note, ...prev]);
    setSelectedId(note.id);
    if (!matchId) setView('notes');
    setToast(matchId ? 'Nova observação criada no jogo' : 'Nota criada');
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


  async function startRecording() {
    if (!window.isSecureContext) {
      setToast('O microfone requer HTTPS. Abre o NOTECOACH pelo endereço https://notecoach.vercel.app');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setToast('Este navegador não suporta gravação de áudio. Usa Chrome ou Edge atualizado.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      chunks.current = [];

      let targetId = selected?.id || null;
      if (view === 'match' || !targetId) {
        const now = new Date().toISOString();
        const note: Note = {
          id: uid('note'), title: activeMatch ? 'Debrief pós-jogo' : 'Observação de áudio', text: '', category: 'Geral', tags: activeMatch ? ['Debrief'] : [],
          created: now, updated: now, matchId: matchId || undefined
        };
        setNotes(prev => [note, ...prev]);
        setSelectedId(note.id);
        targetId = note.id;
      }
      recordingNoteId.current = targetId;

      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mimeType = preferredTypes.find(type => MediaRecorder.isTypeSupported?.(type)) || '';
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorder.current = rec;
      rec.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
      rec.onerror = () => { stream.getTracks().forEach(t => t.stop()); setRecording(false); setPaused(false); setToast('Ocorreu um erro durante a gravação'); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
        const audioId = uid('audio');
        await saveAudio(audioId, blob);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(blob));
        const target = recordingNoteId.current;
        if (target) setNotes(prev => prev.map(n => n.id === target ? { ...n, audioId, duration: seconds, updated: new Date().toISOString() } : n));
        setToast('Gravação guardada na nota');
        recordingNoteId.current = null;
      };
      rec.start(250);
      setSeconds(0);
      setRecording(true);
      setPaused(false);
      setToast('Microfone ativo — a gravar');
    } catch (error: any) {
      const name = error?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setToast('Microfone bloqueado. Permite o microfone nas definições do site e tenta novamente.');
      } else if (name === 'NotFoundError') {
        setToast('Não foi encontrado nenhum microfone neste dispositivo.');
      } else if (name === 'NotReadableError') {
        setToast('O microfone está a ser usado por outra aplicação.');
      } else {
        setToast('Não foi possível aceder ao microfone. Verifica as permissões do browser.');
      }
    }
  }

  function stopRecording() {
    const r = mediaRecorder.current;
    if (r && r.state !== 'inactive') r.stop();
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
      ? notes.filter(n => n.matchId === activeMatch.id)
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
    text += '\n---\nNOTA: Esta é uma organização automática das notas. O relatório é organizado automaticamente a partir das tuas notas.';
    setReport(text);
    setView('report');
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
          <div><strong>NOTECOACH</strong><span>FOOTBALL NOTES • 3.2</span></div>
        </div>
        <div className="topActions">
          <button className="iconBtn" onClick={() => setShowSettings(v => !v)} title="Definições"><Settings2 size={19}/></button>
          {!isStandalone && <button className="secondary installBtn" onClick={installApp}><Download size={17}/> Instalar</button>}
          <button className="primary" onClick={() => newNote()}><Plus size={18}/> Nova nota</button>
        </div>
      </header>

      <div className="layout">
        <aside className={`sidebar ${isMobileMenu ? 'mobileOpen' : ''}`}>
          <nav>
            <button className={view === 'notes' ? 'nav active' : 'nav'} onClick={() => { setView('notes'); setIsMobileMenu(false); }}><FileText size={18}/> Notas <b>{noteCount}</b></button>
            <button className={view === 'match' ? 'nav active' : 'nav'} onClick={() => { setView('match'); setIsMobileMenu(false); }}><Headphones size={18}/> Debrief <b>{matchCount}</b></button>
            <button className={view === 'report' ? 'nav active' : 'nav'} onClick={() => { if (!report) generateReport(); else setView('report'); setIsMobileMenu(false); }}><BarChart3 size={18}/> Relatórios</button>
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
                <div><p className="eyebrow">CENTRO DE NOTAS</p><h1>As tuas ideias. O teu jogo.</h1><p className="muted">Escreve, grava, transcreve e organiza as tuas observações num só lugar.</p></div>
                <div className="stats"><div><b>{noteCount}</b><span>Notas</span></div><div><b>{audioCount}</b><span>Áudios</span></div></div>
              </div>

              <div className="searchRow">
                <div className="search"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar notas, observações ou etiquetas..." /></div>
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
              <div className="pageHead">
                <div>
                  <p className="eyebrow">DEBRIEF PÓS-JOGO</p>
                  <h1>Despeja tudo o que te ficou do jogo. 🎙️</h1>
                  <p className="muted">Não precisas de organizar as ideias. Fala, escreve e guarda. Depois transformamos tudo em relatório.</p>
                </div>
                <button className="primary" onClick={() => setMatchOpen(true)}><Plus size={18}/> Novo jogo</button>
              </div>

              {!activeMatch ? (
                <div className="empty large">
                  <Headphones size={40}/>
                  <h2>Começa por criar um jogo</h2>
                  <p>Depois do apito final, abre este espaço e começa a debitar tudo o que te lembras.</p>
                  <button className="primary" onClick={() => setMatchOpen(true)}><Plus size={17}/> Criar jogo</button>
                </div>
              ) : (
                <>
                  <div className="matchBanner">
                    <div>
                      <span className="eyebrow">JOGO SELECIONADO</span>
                      <h2>{activeMatch.opponent}</h2>
                      <p>{activeMatch.competition} · {activeMatch.date}</p>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',justifyContent:'flex-end'}}>
                      <select value={activeMatch.status} onChange={e => setMatches(ms => ms.map(m => m.id === activeMatch.id ? {...m, status: e.target.value as MatchStatus} : m))}>
                        {(['Preparação','Ao Vivo','Finalizado'] as MatchStatus[]).map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="debriefHero">
                    <div className="debriefHeroIcon"><Mic size={30}/></div>
                    <div>
                      <span className="eyebrow">DEBRIEF DO TREINADOR</span>
                      <h2>Fala livremente sobre o jogo.</h2>
                      <p>O que correu bem? Onde tivemos problemas? O que viste nas transições, nas bolas paradas e individualmente? Não filtres as ideias — regista-as.</p>
                    </div>
                  </div>

                  <div className="liveArea">
                    <div className="liveCard">
                      <div className="liveHead"><span><span className="liveDot"/> GRAVAR DEBRIEF</span><strong>{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</strong></div>
                      <div className="recordCircle">{recording ? <CircleStop size={38}/> : <Mic size={38}/>}</div>
                      <p>{recording ? (paused ? 'Gravação em pausa' : 'A gravar o teu debrief...') : 'Entra no carro, carrega em gravar e começa a falar.'}</p>
                      <div className="recordActions">
                        {!recording ? <button className="primary round" onClick={startRecording}><Mic size={18}/> Gravar debrief</button> : <>
                          <button className="secondary" onClick={togglePause}>{paused ? <Play size={17}/> : <Pause size={17}/>} {paused ? 'Retomar' : 'Pausa'}</button>
                          <button className="danger" onClick={stopRecording}><CircleStop size={17}/> Guardar</button>
                        </>}
                      </div>
                      {audioUrl && <audio controls src={audioUrl}/>} 
                    </div>

                    <div className="liveCard transcriptCard">
                      <div className="liveHead"><span><Sparkles size={17}/> OBSERVAÇÃO ESCRITA / VOZ</span><button className={listening ? 'danger small' : 'secondary small'} onClick={toggleSpeech}>{listening ? 'Parar voz' : 'Falar para texto'}</button></div>
                      <textarea value={selected?.matchId === activeMatch.id ? selected.text : ''} onChange={e => selected?.matchId === activeMatch.id && updateSelected({text:e.target.value})} placeholder="Também podes escrever aqui. Se começares por gravar, esta área fica associada ao debrief criado." />
                      <div className="row" style={{marginTop:8}}>
                        <button className="secondary" onClick={() => newNote('Geral','')}><Plus size={16}/> Nova observação</button>
                        <button className="secondary" onClick={() => { if(selected?.matchId===activeMatch.id){updateSelected({text:`${selected.text}\n\n${transcript}`.trim()}); setTranscript(''); setToast('Texto acrescentado ao debrief');} }} disabled={!transcript || selected?.matchId!==activeMatch.id}>Adicionar transcrição</button>
                      </div>
                      {transcript && <div className="transcriptPreview"><span>Transcrição em espera</span><p>{transcript}</p></div>}
                    </div>
                  </div>

                  <div className="debriefSections">
                    <div className="liveCard">
                      <div className="liveHead"><span><FileText size={17}/> OBSERVAÇÕES DESTE JOGO</span><strong>{notes.filter(n => n.matchId === activeMatch.id).length}</strong></div>
                      <div className="debriefNotes">
                        {notes.filter(n => n.matchId === activeMatch.id).sort((a,b)=>b.updated.localeCompare(a.updated)).map(n => (
                          <div key={n.id} className={selectedId===n.id ? 'debriefNote selected' : 'debriefNote'} onClick={()=>{setSelectedId(n.id);loadAudio(n)}}>
                            <div><span className="pill">{n.category}</span>{n.audioId && <span className="audioBadge"><Headphones size={12}/> áudio</span>}</div>
                            <b>{n.title}</b>
                            <p>{n.text || 'Sem texto — apenas gravação.'}</p>
                            <small>{formatDate(n.updated)}</small>
                          </div>
                        ))}
                        {notes.filter(n => n.matchId === activeMatch.id).length===0 && <p className="muted">Ainda não tens observações neste jogo. Começa pelo debrief.</p>}
                      </div>
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

      {showSettings && <div className="settings"><div className="settingsTitle"><Settings2 size={18}/> Definições <button onClick={() => setShowSettings(false)}><X size={17}/></button></div><p>Os dados desta versão ficam guardados localmente no dispositivo.</p><div className="settingRow"><span>Modo offline</span><b>ATIVO</b></div><div className="settingRow"><span>Versão</span><b>3.2</b></div></div>}

      {matchOpen && <div className="modalBack"><div className="modal"><div className="modalHead"><h2>Novo jogo</h2><button onClick={() => setMatchOpen(false)}><X/></button></div><label>Adversário<input autoFocus value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="Ex.: Benfica"/></label><label>Competição<input value={competition} onChange={e => setCompetition(e.target.value)} placeholder="Ex.: Campeonato Nacional"/></label><label>Data<input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)}/></label><label>Estado<select value={status} onChange={e => setStatus(e.target.value as MatchStatus)}><option>Preparação</option><option>Ao Vivo</option><option>Finalizado</option></select></label><button className="primary full" onClick={createMatch}><Check size={18}/> Criar jogo</button></div></div>}

      {toast && <div className="toast"><Check size={16}/>{toast}</div>}
    </main>
  );
}
