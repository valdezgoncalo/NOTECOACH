"use client";
import {useEffect,useRef,useState} from "react";
import {Mic,Square,Pause,Play,Plus,Search,Trash2,Save,FileText,Volume2} from "lucide-react";

type Note={id:string;title:string;text:string;created:string;audio?:string;duration?:number};
const KEY="notecoach_notes_v1";

export default function Home(){
 const [notes,setNotes]=useState<Note[]>([]);
 const [active,setActive]=useState<Note|null>(null);
 const [recording,setRecording]=useState(false);
 const [paused,setPaused]=useState(false);
 const [seconds,setSeconds]=useState(0);
 const [search,setSearch]=useState("");
 const [transcript,setTranscript]=useState("");
 const [supported,setSupported]=useState(true);
 const media=useRef<MediaRecorder|null>(null); const chunks=useRef<Blob[]>([]);
 const recognition=useRef<any>(null);

 useEffect(()=>{try{setNotes(JSON.parse(localStorage.getItem(KEY)||"[]"))}catch{}},[]);
 useEffect(()=>{localStorage.setItem(KEY,JSON.stringify(notes))},[notes]);
 useEffect(()=>{if(!recording||paused)return; const t=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(t)},[recording,paused]);

 function newNote(){const n:Note={id:crypto.randomUUID(),title:"Nova nota",text:"",created:new Date().toLocaleString("pt-PT")};setNotes(x=>[n,...x]);setActive(n);setTranscript("")}
 function update(field:keyof Note,value:string){if(!active)return;const n={...active,[field]:value};setActive(n);setNotes(x=>x.map(a=>a.id===n.id?n:a))}
 async function start(){
   try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    chunks.current=[]; const r=new MediaRecorder(stream); media.current=r;
    r.ondataavailable=e=>e.data.size&&chunks.current.push(e.data);
    r.onstop=()=>{const blob=new Blob(chunks.current,{type:"audio/webm"});const url=URL.createObjectURL(blob); if(active){const n={...active,audio:url,duration:seconds};setActive(n);setNotes(x=>x.map(a=>a.id===n.id?n:a))} stream.getTracks().forEach(t=>t.stop())};
    r.start(); setRecording(true);setPaused(false);setSeconds(0);
    const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(SR){const sr=new SR();sr.lang="pt-PT";sr.continuous=true;sr.interimResults=true;sr.onresult=(e:any)=>{let final="";for(let i=e.resultIndex;i<e.results.length;i++)final+=e.results[i][0].transcript+" ";setTranscript(t=>t+final)};sr.start();recognition.current=sr}else setSupported(false);
   }catch{alert("Não foi possível aceder ao microfone. Verifica as permissões do navegador.")}
 }
 function stop(){media.current?.stop();recognition.current?.stop();setRecording(false);setPaused(false)}
 function togglePause(){if(!media.current)return;if(paused){media.current.resume();setPaused(false)}else{media.current.pause();setPaused(true)}}
 function deleteNote(){if(!active)return;setNotes(x=>x.filter(n=>n.id!==active.id));setActive(null)}
 const filtered=notes.filter(n=>(n.title+" "+n.text).toLowerCase().includes(search.toLowerCase()));
 return <main>
  <header><div className="brand"><div className="logo">N</div><div><b>NOTECOACH</b><span>Grava. Transcreve. Organiza.</span></div></div><div className="topsearch"><Search size={17}/><input placeholder="Pesquisar notas..." value={search} onChange={e=>setSearch(e.target.value)}/></div></header>
  <section className="shell">
   <aside><button className="primary" onClick={newNote}><Plus size={19}/> Nova nota</button><div className="side-title">NOTAS</div>{filtered.map(n=><button className={"note-row "+(active?.id===n.id?"selected":"")} key={n.id} onClick={()=>{setActive(n);setTranscript("")}}><FileText size={17}/><span><b>{n.title}</b><small>{n.created}</small></span></button>)}</aside>
   <article>
    {!active?<div className="empty"><div className="empty-icon">🎙️</div><h1>O teu bloco de notas inteligente</h1><p>Cria uma nota e começa a gravar. A transcrição aparece automaticamente quando o navegador suporta reconhecimento de voz.</p><button className="primary" onClick={newNote}><Plus size={19}/> Criar primeira nota</button></div>:
    <><div className="editor-head"><div><input className="title" value={active.title} onChange={e=>update("title",e.target.value)}/><div className="date">{active.created}</div></div><button className="icon-btn danger" onClick={deleteNote}><Trash2 size={19}/></button></div>
    <textarea className="editor" placeholder="Escreve aqui ou começa uma gravação..." value={active.text} onChange={e=>update("text",e.target.value)}/>
    <div className="recorder">
      <div className="rec-top"><span>{recording?"● A gravar":"Gravador de voz"}</span><strong>{String(Math.floor(seconds/60)).padStart(2,"0")}:{String(seconds%60).padStart(2,"0")}</strong></div>
      <div className="rec-controls">{!recording?<button className="record" onClick={start}><Mic size={21}/> Gravar</button>:<><button className="icon-btn" onClick={togglePause}>{paused?<Play/>:<Pause/>}</button><button className="record stop" onClick={stop}><Square size={18}/> Parar</button></>}</div>
      {active.audio&&<div className="audio"><Volume2 size={17}/><audio controls src={active.audio}/></div>}
      {!supported&&<small className="hint">O teu navegador não disponibiliza Speech Recognition. A gravação continua disponível; podemos ligar transcrição por API na V1.1.</small>}
    </div>
    <div className="transcription"><div className="section-label">TRANSCRIÇÃO</div><textarea placeholder="A transcrição da gravação aparecerá aqui..." value={transcript} onChange={e=>setTranscript(e.target.value)}/><div className="actions"><button className="secondary" onClick={()=>{if(!transcript)return;update("text",(active.text?active.text+"\n\n":"")+transcript);setTranscript("")}}><Save size={17}/> Passar para a nota</button><span>Guardado automaticamente</span></div></div>
    </>}
   </article>
  </section>
 </main>
}
