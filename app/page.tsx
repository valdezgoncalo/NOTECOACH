```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Square,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  Save,
  FileText,
  Volume2,
  MoreVertical,
} from "lucide-react";

type Note = {
  id: string;
  title: string;
  text: string;
  created: string;
  updated: string;
  audioId?: string;
  duration?: number;
};

const NOTES_KEY = "notecoach_notes_v11";
const AUDIO_DB = "notecoach_audio_v11";
const AUDIO_STORE = "recordings";

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [active, setActive] = useState<Note | null>(null);

  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const [search, setSearch] = useState("");
  const [transcript, setTranscript] = useState("");

  const [speechSupported, setSpeechSupported] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<any>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);

  /* =========================
     CARREGAR NOTAS
  ========================= */

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NOTES_KEY);

      if (saved) {
        setNotes(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Erro ao carregar notas:", error);
    }
  }, []);

  /* =========================
     GUARDAR NOTAS
  ========================= */

  useEffect(() => {
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    } catch (error) {
      console.error("Erro ao guardar notas:", error);
    }
  }, [notes]);

  /* =========================
     LIMPEZA AUDIO URL
  ========================= */

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  /* =========================
     CARREGAR AUDIO DA NOTA
  ========================= */

  useEffect(() => {
    if (!active?.audioId) {
      setAudioUrl(null);
      return;
    }

    let cancelled = false;
    let temporaryUrl: string | null = null;

    async function loadAudio() {
      try {
        const blob = await getAudio(active!.audioId!);

        if (!blob || cancelled) return;

        temporaryUrl = URL.createObjectURL(blob);

        setAudioUrl(temporaryUrl);
      } catch (error) {
        console.error("Erro ao carregar áudio:", error);
      }
    }

    loadAudio();

    return () => {
      cancelled = true;

      if (temporaryUrl) {
        URL.revokeObjectURL(temporaryUrl);
      }
    };
  }, [active?.id, active?.audioId]);

  /* =========================
     CRONÓMETRO
  ========================= */

  useEffect(() => {
    if (!recording || paused) return;

    timer.current = window.setInterval(() => {
      setSeconds((value) => value + 1);
    }, 1000);

    return () => {
      if (timer.current) {
        window.clearInterval(timer.current);
      }
    };
  }, [recording, paused]);

  /* =========================
     NOVA NOTA
  ========================= */

  function createNote() {
    const now = new Date().toLocaleString("pt-PT");

    const note: Note = {
      id: crypto.randomUUID(),
      title: "Nova nota",
      text: "",
      created: now,
      updated: now,
    };

    setNotes((current) => [note, ...current]);
    setActive(note);
    setTranscript("");
    setSeconds(0);
  }

  /* =========================
     ATUALIZAR NOTA
  ========================= */

  function updateNote(
    field: keyof Note,
    value: string | number
  ) {
    if (!active) return;

    const updated: Note = {
      ...active,
      [field]: value,
      updated: new Date().toLocaleString("pt-PT"),
    };

    setActive(updated);

    setNotes((current) =>
      current.map((note) =>
        note.id === updated.id ? updated : note
      )
    );
  }

  /* =========================
     GRAVAR
  ========================= */

  async function startRecording() {
    if (!active) {
      createNote();
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      chunks.current = [];

      const recorder = new MediaRecorder(stream);

      mediaRecorder.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunks.current, {
            type: recorder.mimeType || "audio/webm",
          });

          const audioId = crypto.randomUUID();

          await saveAudio(audioId, blob);

          const updated: Note = {
            ...active,
            audioId,
            duration: seconds,
            updated: new Date().toLocaleString("pt-PT"),
          };

          setActive(updated);

          setNotes((current) =>
            current.map((note) =>
              note.id === updated.id ? updated : note
            )
          );

          const url = URL.createObjectURL(blob);

          setAudioUrl((old) => {
            if (old) URL.revokeObjectURL(old);
            return url;
          });

          stream.getTracks().forEach((track) =>
            track.stop()
          );
        } catch (error) {
          console.error("Erro ao guardar gravação:", error);
        }
      };

      recorder.start();

      setRecording(true);
      setPaused(false);
      setSeconds(0);

      /* =========================
         SPEECH RECOGNITION
      ========================= */

      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const speech = new SpeechRecognition();

        speech.lang = "pt-PT";
        speech.continuous = true;
        speech.interimResults = false;

        speech.onresult = (event: any) => {
          let text = "";

          for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
          ) {
            if (event.results[i].isFinal) {
              text +=
                event.results[i][0].transcript + " ";
            }
          }

          if (text.trim()) {
            setTranscript((current) =>
              current + text
            );
          }
        };

        speech.onerror = () => {
          setSpeechSupported(false);
        };

        try {
          speech.start();
          recognition.current = speech;
        } catch {
          setSpeechSupported(false);
        }
      } else {
        setSpeechSupported(false);
      }
    } catch (error) {
      console.error(error);

      alert(
        "Não foi possível aceder ao microfone. Verifica as permissões do navegador."
      );
    }
  }

  /* =========================
     PARAR
  ========================= */

  function stopRecording() {
    mediaRecorder.current?.stop();

    recognition.current?.stop();

    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }

    setRecording(false);
    setPaused(false);
  }

  /* =========================
     PAUSAR
  ========================= */

  function togglePause() {
    if (!mediaRecorder.current) return;

    if (paused) {
      mediaRecorder.current.resume();

      try {
        recognition.current?.start();
      } catch {}

      setPaused(false);
    } else {
      mediaRecorder.current.pause();

      recognition.current?.stop();

      setPaused(true);
    }
  }

  /* =========================
     APAGAR NOTA
  ========================= */

  async function deleteNote() {
    if (!active) return;

    const confirmed = window.confirm(
      "Tens a certeza que queres apagar esta nota?"
    );

    if (!confirmed) return;

    if (active.audioId) {
      await deleteAudio(active.audioId);
    }

    setNotes((current) =>
      current.filter(
        (note) => note.id !== active.id
      )
    );

    setActive(null);
    setTranscript("");
  }

  /* =========================
     PASSAR TRANSCRIÇÃO PARA NOTA
  ========================= */

  function addTranscriptToNote() {
    if (!active || !transcript.trim()) return;

    const newText =
      active.text.trim().length > 0
        ? `${active.text}\n\n${transcript.trim()}`
        : transcript.trim();

    updateNote("text", newText);

    setTranscript("");
  }

  /* =========================
     PESQUISA
  ========================= */

  const filteredNotes = notes.filter((note) =>
    `${note.title} ${note.text}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  /* =========================
     FORMATAR TEMPO
  ========================= */

  function formatTime(total: number) {
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;

    return `${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  }

  return (
    <main>
      {/* HEADER */}

      <header>
        <div className="brand">
          <div className="logo">N</div>

          <div>
            <b>NOTECOACH</b>

            <span>
              Grava. Transcreve. Organiza.
            </span>
          </div>
        </div>

        <div className="topsearch">
          <Search size={17} />

          <input
            placeholder="Pesquisar notas..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>
      </header>

      {/* APP */}

      <section className="shell">

        {/* SIDEBAR */}

        <aside>
          <button
            className="primary"
            onClick={createNote}
          >
            <Plus size={19} />
            Nova nota
          </button>

          <div className="side-title">
            MINHAS NOTAS
          </div>

          {filteredNotes.map((note) => (
            <button
              key={note.id}
              className={`note-row ${
                active?.id === note.id
                  ? "selected"
                  : ""
              }`}
              onClick={() => {
                setActive(note);
                setTranscript("");
              }}
            >
              <FileText size={17} />

              <span>
                <b>{note.title}</b>

                <small>
                  {note.updated}
                </small>
              </span>
            </button>
          ))}

          {filteredNotes.length === 0 && (
            <div className="no-notes">
              Ainda não tens notas.
            </div>
          )}
        </aside>

        {/* EDITOR */}

        <article>

          {!active ? (
            <div className="empty">

              <div className="empty-icon">
                🎙️
              </div>

              <h1>
                O teu bloco de notas inteligente
              </h1>

              <p>
                Grava ideias, reuniões, observações
                e análises. Guarda tudo num só lugar.
              </p>

              <button
                className="primary empty-button"
                onClick={createNote}
              >
                <Plus size={19} />
                Criar primeira nota
              </button>

            </div>
          ) : (

            <>

              {/* TÍTULO */}

              <div className="editor-head">

                <div>
                  <input
                    className="title"
                    value={active.title}
                    onChange={(event) =>
                      updateNote(
                        "title",
                        event.target.value
                      )
                    }
                  />

                  <div className="date">
                    Criada em {active.created}
                  </div>
                </div>

                <button
                  className="icon-btn danger"
                  onClick={deleteNote}
                  title="Apagar nota"
                >
                  <Trash2 size={19} />
                </button>

              </div>

              {/* TEXTO */}

              <textarea
                className="editor"
                placeholder="Escreve aqui..."
                value={active.text}
                onChange={(event) =>
                  updateNote(
                    "text",
                    event.target.value
                  )
                }
              />

              {/* GRAVADOR */}

              <div className="recorder">

                <div className="rec-top">

                  <span>
                    {recording
                      ? paused
                        ? "⏸ Gravação pausada"
                        : "🔴 A gravar"
                      : active.audioId
                      ? "🎧 Gravação guardada"
                      : "🎙️ Gravador de voz"}
                  </span>

                  <strong>
                    {formatTime(
                      recording
                        ? seconds
                        : active.duration || 0
                    )}
                  </strong>

                </div>

                <div className="rec-controls">

                  {!recording ? (
                    <button
                      className="record"
                      onClick={startRecording}
                    >
                      <Mic size={21} />
                      Gravar
                    </button>
                  ) : (
                    <>
                      <button
                        className="icon-btn"
                        onClick={togglePause}
                        title={
                          paused
                            ? "Continuar"
                            : "Pausar"
                        }
                      >
                        {paused ? (
                          <Play />
                        ) : (
                          <Pause />
                        )}
                      </button>

                      <button
                        className="record stop"
                        onClick={stopRecording}
                      >
                        <Square size={18} />
                        Parar
                      </button>
                    </>
                  )}

                </div>

                {/* AUDIO */}

                {audioUrl && (
                  <div className="audio">

                    <Volume2 size={17} />

                    <audio
                      controls
                      src={audioUrl}
                    />

                  </div>
                )}

                {/* AVISO */}

                {!speechSupported && (
                  <small className="hint">
                    A gravação de áudio funciona
                    normalmente. A transcrição automática
                    não está disponível neste navegador.
                    Na próxima versão vamos ligar uma
                    transcrição profissional por API.
                  </small>
                )}

              </div>

              {/* TRANSCRIÇÃO */}

              <div className="transcription">

                <div className="transcription-head">
                  <div className="section-label">
                    TRANSCRIÇÃO
                  </div>

                  <span>
                    {transcript
                      ? "Transcrição em curso"
                      : "Pronto"}
                  </span>
                </div>

                <textarea
                  placeholder="A transcrição aparecerá aqui..."
                  value={transcript}
                  onChange={(event) =>
                    setTranscript(
                      event.target.value
                    )
                  }
                />

                <div className="actions">

                  <button
                    className="secondary"
                    onClick={
                      addTranscriptToNote
                    }
                    disabled={
                      !transcript.trim()
                    }
                  >
                    <Save size={17} />
                    Passar para a nota
                  </button>

                  <span>
                    Guardado automaticamente
                  </span>

                </div>

              </div>

              {/* INFO */}

              <div className="editor-footer">
                <span>
                  Última alteração:{" "}
                  {active.updated}
                </span>

                <MoreVertical size={17} />
              </div>

            </>
          )}

        </article>
      </section>
    </main>
  );
}

/* =====================================================
   INDEXED DB — ÁUDIO
===================================================== */

function openAudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {

    const request = indexedDB.open(
      AUDIO_DB,
      1
    );

    request.onupgradeneeded = () => {
      const database = request.result;

      if (
        !database.objectStoreNames.contains(
          AUDIO_STORE
        )
      ) {
        database.createObjectStore(
          AUDIO_STORE
        );
      }
    };

    request.onsuccess = () =>
      resolve(request.result);

    request.onerror = () =>
      reject(request.error);
  });
}

async function saveAudio(
  id: string,
  blob: Blob
) {
  const database =
    await openAudioDB();

  return new Promise<void>(
    (resolve, reject) => {

      const transaction =
        database.transaction(
          AUDIO_STORE,
          "readwrite"
        );

      transaction
        .objectStore(AUDIO_STORE)
        .put(blob, id);

      transaction.oncomplete =
        () => resolve();

      transaction.onerror =
        () => reject(transaction.error);
    }
  );
}

async function getAudio(
  id: string
): Promise<Blob | null> {

  const database =
    await openAudioDB();

  return new Promise(
    (resolve, reject) => {

      const transaction =
        database.transaction(
          AUDIO_STORE,
          "readonly"
        );

      const request =
        transaction
          .objectStore(AUDIO_STORE)
          .get(id);

      request.onsuccess = () =>
        resolve(request.result || null);

      request.onerror = () =>
        reject(request.error);
    }
  );
}

async function deleteAudio(
  id: string
) {
  const database =
    await openAudioDB();

  return new Promise<void>(
    (resolve, reject) => {

      const transaction =
        database.transaction(
          AUDIO_STORE,
          "readwrite"
        );

      transaction
        .objectStore(AUDIO_STORE)
        .delete(id);

      transaction.oncomplete =
        () => resolve();

      transaction.onerror =
        () => reject(transaction.error);
    }
  );
}
```
