import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import * as THREE from 'three';
import './App.css';
import { SceneController } from './scene';
import type { DebugConfig, SceneObjectData } from './scene';
import { CATEGORIES, MODEL_BY_KIND, MODEL_DEFS } from './models';
import type { KindId } from './models';
import { QUESTIONS } from './questions';
import { CATEGORY_TEXT, KIND_TEXT, LANGS, facingVsCamera, t } from './i18n';
import type { Lang } from './i18n';

interface SceneState {
  questionId: number | null;
  objects: SceneObjectData[];
}

interface HistoryState {
  past: SceneState[];
  present: SceneState;
  future: SceneState[];
}

type Action =
  | { type: 'add'; kind: KindId }
  | { type: 'remove'; id: string }
  | { type: 'move'; id: string; x: number; y: number; z: number; rotY: number; record: boolean }
  | { type: 'clear' }
  | { type: 'loadQuestion'; n: number }
  | { type: 'loadJSON'; data: SceneState }
  | { type: 'undo' }
  | { type: 'redo' };

const HISTORY_LIMIT = 100;

const initialHistory: HistoryState = { past: [], present: { questionId: null, objects: [] }, future: [] };

let seq = 0;

function createObject(kind: KindId): SceneObjectData {
  seq += 1;
  let x: number;
  let z: number;
  let rotY: number;
  if (kind === 'school') {
    x = 0;
    z = -4.2;
    rotY = 0;
  } else {
    const angle = Math.random() * Math.PI * 2;
    const r = 1.0 + Math.random() * 2.8;
    x = Math.cos(angle) * r;
    z = Math.sin(angle) * r;
    rotY = Math.random() * Math.PI * 2;
  }
  return { id: `obj-${seq}`, kind, x, y: 0, z, rotY };
}

function reducer(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case 'add': {
      const obj = createObject(action.kind);
      const present = { ...state.present, objects: [...state.present.objects, obj] };
      return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present, future: [] };
    }
    case 'remove': {
      const present = {
        ...state.present,
        objects: state.present.objects.filter((o) => o.id !== action.id),
      };
      return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present, future: [] };
    }
    case 'move': {
      const objects = state.present.objects.map((o) =>
        o.id === action.id ? { ...o, x: action.x, y: action.y, z: action.z, rotY: action.rotY } : o,
      );
      const present = { ...state.present, objects };
      if (action.record === false) return { ...state, present };
      return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present, future: [] };
    }
    case 'clear': {
      if (state.present.objects.length === 0) return state;
      const present = { questionId: state.present.questionId, objects: [] };
      return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present, future: [] };
    }
    case 'loadQuestion': {
      const question = QUESTIONS.find((q) => q.id === action.n);
      if (!question) return state;
      const objects = question.items.map((kind) => createObject(kind));
      const present = { questionId: action.n, objects };
      return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present, future: [] };
    }
    case 'loadJSON': {
      return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present: action.data, future: [] };
    }
    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future].slice(0, HISTORY_LIMIT),
      };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: state.future.slice(1),
      };
    }
  }
}

interface ExportData {
  version: 1;
  questionId: number | null;
  objects: SceneObjectData[];
  cameraAngles?: Record<string, number>;
  camera?: { x: number; y: number; z: number; tx: number; ty: number; tz: number };
  labelsVisible?: boolean;
  lang?: Lang;
}

function parseExport(text: string): {
  state: SceneState;
  camera: ExportData['camera'];
  labelsVisible: boolean;
  lang: Lang;
} {
  const data = JSON.parse(text) as Partial<ExportData>;
  if (!Array.isArray(data.objects)) throw new Error('Invalid scene JSON');
  const objects = data.objects.filter((o): o is SceneObjectData => {
    return (
      !!o &&
      typeof o.id === 'string' &&
      typeof o.kind === 'string' &&
      o.kind in MODEL_BY_KIND &&
      typeof o.x === 'number' &&
      typeof o.y === 'number' &&
      typeof o.z === 'number' &&
      typeof o.rotY === 'number'
    );
  });
  const cam = data.camera;
  const camera =
    cam &&
    typeof cam.x === 'number' &&
    typeof cam.y === 'number' &&
    typeof cam.z === 'number' &&
    typeof cam.tx === 'number' &&
    typeof cam.ty === 'number' &&
    typeof cam.tz === 'number'
      ? { x: cam.x, y: cam.y, z: cam.z, tx: cam.tx, ty: cam.ty, tz: cam.tz }
      : undefined;
  return {
    state: {
      questionId: typeof data.questionId === 'number' ? data.questionId : null,
      objects,
    },
    camera,
    labelsVisible: data.labelsVisible === undefined ? true : !!data.labelsVisible,
    lang: data.lang === 'ja' || data.lang === 'en' || data.lang === 'sv' ? data.lang : 'ja',
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SceneController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [history, dispatch] = useReducer(reducer, initialHistory);
  const { past, present, future } = history;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rotateMode, setRotateMode] = useState(false);
  const [labelsVisible, setLabelsVisible] = useState(true);
  const [debug, setDebug] = useState<DebugConfig>({ enabled: false });
  const [cam, setCam] = useState<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [lang, setLang] = useState<Lang>('ja');

  useEffect(() => {
    if (!containerRef.current) return;
    const controller = new SceneController(containerRef.current, {
      onSelect: (id) => setSelectedId(id),
      onMove: (id, x, y, z, rotY) => dispatch({ type: 'move', id, x, y, z, rotY, record: true }),
      onViewChange: () => setCam(controllerRef.current?.getCameraState() ?? null),
    });
    controllerRef.current = controller;
    setCam(controller.getCameraState());
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const texts: Record<string, string> = {};
    for (const [kind, kt] of Object.entries(KIND_TEXT[lang])) {
      if (kt.labelText) texts[kind] = kt.labelText;
    }
    controllerRef.current?.setLabelTexts(texts);
  }, [lang]);

  useEffect(() => {
    controllerRef.current?.setObjects(present.objects);
  }, [present.objects]);

  useEffect(() => {
    controllerRef.current?.setSelection(selectedId);
  }, [selectedId]);

  useEffect(() => {
    controllerRef.current?.setDebug(debug);
  }, [debug]);

  useEffect(() => {
    controllerRef.current?.setRotateMode(rotateMode);
  }, [rotateMode]);

  useEffect(() => {
    controllerRef.current?.setLabelsVisible(labelsVisible);
  }, [labelsVisible]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) dispatch({ type: 'redo' });
        else dispatch({ type: 'undo' });
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'redo' });
      } else if (e.key === 'Delete' && selectedId) {
        dispatch({ type: 'remove', id: selectedId });
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const countByKind = useMemo(() => {
    const m = new Map<KindId, number>();
    for (const o of present.objects) m.set(o.kind, (m.get(o.kind) ?? 0) + 1);
    return m;
  }, [present.objects]);

  const selectedObj = present.objects.find((o) => o.id === selectedId) ?? null;
  const persons = present.objects.filter((o) => MODEL_BY_KIND[o.kind].isPerson);

  const cameraAngles = useMemo(() => {
    if (!cam) return null;
    const out: Record<string, number> = {};
    for (const o of persons) {
      const fx = -Math.sin(o.rotY);
      const fz = -Math.cos(o.rotY);
      const mx = cam.target.x - cam.pos.x;
      const mz = cam.target.z - cam.pos.z;
      const len = Math.hypot(mx, mz);
      if (len < 1e-6) continue;
      const cosA = (fx * mx + fz * mz) / len;
      out[o.id] = Math.round((Math.acos(Math.min(1, Math.max(-1, cosA))) * 180) / Math.PI);
    }
    return out;
  }, [persons, cam]);

  const addItem = (kind: KindId) => dispatch({ type: 'add', kind });
  const clearScene = () => dispatch({ type: 'clear' });
  const loadQuestion = (n: number) => dispatch({ type: 'loadQuestion', n });
  const undo = () => dispatch({ type: 'undo' });
  const redo = () => dispatch({ type: 'redo' });
  const removeSelected = () => {
    if (!selectedId) return;
    dispatch({ type: 'remove', id: selectedId });
    setSelectedId(null);
  };
  const rotateHold = useRef<{ timer: number; baseRotY: number; accum: number } | null>(null);
  const startRotateHold = (e: React.PointerEvent<HTMLButtonElement>, deg: number) => {
    if (!selectedObj || rotateHold.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const baseRotY = selectedObj.rotY;
    rotateHold.current = { timer: 0, baseRotY, accum: 0 };
    dispatch({
      type: 'move',
      id: selectedObj.id,
      x: selectedObj.x,
      y: selectedObj.y,
      z: selectedObj.z,
      rotY: baseRotY,
      record: true,
    });
    const apply = () => {
      const h = rotateHold.current;
      if (!h) return;
      h.accum += deg;
      dispatch({
        type: 'move',
        id: selectedObj.id,
        x: selectedObj.x,
        y: selectedObj.y,
        z: selectedObj.z,
        rotY: h.baseRotY + (h.accum * Math.PI) / 180,
        record: false,
      });
    };
    apply();
    rotateHold.current.timer = window.setInterval(apply, 150);
  };
  const stopRotateHold = () => {
    const h = rotateHold.current;
    rotateHold.current = null;
    if (!h) return;
    window.clearInterval(h.timer);
  };
  const onHeightChange = (y: number) => {
    if (!selectedObj) return;
    dispatch({
      type: 'move',
      id: selectedObj.id,
      x: selectedObj.x,
      y,
      z: selectedObj.z,
      rotY: selectedObj.rotY,
      record: false,
    });
  };
  const commitHeight = () => {
    if (!selectedObj) return;
    dispatch({
      type: 'move',
      id: selectedObj.id,
      x: selectedObj.x,
      y: selectedObj.y,
      z: selectedObj.z,
      rotY: selectedObj.rotY,
      record: true,
    });
  };
  const snapToGround = () => {
    if (!selectedObj) return;
    dispatch({
      type: 'move',
      id: selectedObj.id,
      x: selectedObj.x,
      y: 0,
      z: selectedObj.z,
      rotY: selectedObj.rotY,
      record: true,
    });
  };

  const downloadJSON = () => {
    const cam = controllerRef.current?.getCameraState() ?? null;
    const data: ExportData = {
      version: 1,
      questionId: present.questionId,
      objects: present.objects,
      cameraAngles: cameraAngles ?? undefined,
      labelsVisible,
      lang,
      ...(cam ? { camera: { x: cam.pos.x, y: cam.pos.y, z: cam.pos.z, tx: cam.target.x, ty: cam.target.y, tz: cam.target.z } } : {}),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scene.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { state, camera, labelsVisible: expLabels, lang: expLang } = parseExport(String(reader.result));
        dispatch({ type: 'loadJSON', data: state });
        setLang(expLang);
        setLabelsVisible(expLabels);
        if (camera) {
          controllerRef.current?.setCameraState(
            new THREE.Vector3(camera.x, camera.y, camera.z),
            new THREE.Vector3(camera.tx, camera.ty, camera.tz),
          );
        }
      } catch {
        alert(t(lang, 'loadError'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="app">
      <div ref={containerRef} className="stage" />

      <header className="topbar">
        <h1>{t(lang, 'title')}</h1>
        <div className="top-actions">
          <button onClick={() => controllerRef.current?.resetCamera()}>{t(lang, 'resetView')}</button>
          <button className={rotateMode ? 'active' : ''} onClick={() => setRotateMode((m) => !m)} title={t(lang, 'rotateModeTitle')}>
            {t(lang, 'rotateMode')}
          </button>
          <button onClick={undo} disabled={past.length === 0} title={t(lang, 'undoTitle')}>
            {t(lang, 'undo')}
          </button>
          <button onClick={redo} disabled={future.length === 0} title={t(lang, 'redoTitle')}>
            {t(lang, 'redo')}
          </button>
          <button onClick={downloadJSON}>{t(lang, 'saveJSON')}</button>
          <button onClick={() => fileRef.current?.click()}>{t(lang, 'loadJSON')}</button>
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="lang-select" title={t(lang, 'help')}>
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <button className="help-btn" onClick={() => setHelpOpen(true)} title={t(lang, 'help')}>
            ?
          </button>
        </div>
      </header>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFileChange} />

      <aside className="panel left">
        <h2>{t(lang, 'toolbox')}</h2>
        {CATEGORIES.map((cat) => (
          <section key={cat.id}>
            <h3>{CATEGORY_TEXT[lang][cat.id]}</h3>
            <div className="items">
              {MODEL_DEFS.filter((d) => d.category === cat.id).map((def) => {
                const count = countByKind.get(def.kind) ?? 0;
                const disabled = count >= def.maxCount;
                const text = KIND_TEXT[lang][def.kind];
                return (
                  <button key={def.kind} className="item" disabled={disabled} onClick={() => addItem(def.kind)}>
                    <span className="item-label">{text.label}</span>
                    {text.sub && <span className="item-sub">{text.sub}</span>}
                    <span className="item-count">
                      {count}/{def.maxCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </aside>

      <aside className="panel right">
        <section>
          <h2>{t(lang, 'questions')}</h2>
          <div className="questions">
            {QUESTIONS.map((q) => (
              <button
                key={q.id}
                className={present.questionId === q.id ? 'active' : ''}
                onClick={() => loadQuestion(q.id)}
              >
                Q{q.id}
              </button>
            ))}
          </div>
          <button onClick={clearScene} disabled={present.objects.length === 0} className="clear-btn">
            {t(lang, 'clearScene')}
          </button>
        </section>

        <section>
          <h2>{t(lang, 'selectedObject')}</h2>
          {selectedObj ? (
            <>
              <p className="sel-name">
                {KIND_TEXT[lang][selectedObj.kind].label}
                {KIND_TEXT[lang][selectedObj.kind].sub ? ` (${KIND_TEXT[lang][selectedObj.kind].sub})` : ''}
              </p>
              <div className="row">
                <button
                  onPointerDown={(e) => startRotateHold(e, -15)}
                  onPointerUp={stopRotateHold}
                  onPointerCancel={stopRotateHold}
                >
                  {t(lang, 'rotateLeft')}
                </button>
                <button
                  onPointerDown={(e) => startRotateHold(e, 15)}
                  onPointerUp={stopRotateHold}
                  onPointerCancel={stopRotateHold}
                >
                  {t(lang, 'rotateRight')}
                </button>
              </div>
              <label className="row">
                {t(lang, 'height')}
                <input
                  type="range"
                  min={0}
                  max={6}
                  step={0.05}
                  value={Math.max(0, Math.min(6, round1(selectedObj.y)))}
                  onChange={(e) => onHeightChange(Number(e.target.value))}
                  onPointerUp={commitHeight}
                  onPointerLeave={commitHeight}
                />
                <span className="val">{round1(selectedObj.y)}m</span>
              </label>
              <div className="row">
                <button onClick={snapToGround}>{t(lang, 'snapToGround')}</button>
                <button className="danger" onClick={removeSelected}>
                  {t(lang, 'delete')}
                </button>
              </div>
            </>
          ) : (
            <p className="muted">{t(lang, 'clickToSelect')}</p>
          )}
        </section>

        <section>
          <h2>{t(lang, 'measurement')}</h2>
          <label className="row">
            <input
              type="checkbox"
              checked={labelsVisible}
              onChange={(e) => setLabelsVisible(e.target.checked)}
            />
            {t(lang, 'showLabels')}
          </label>
          <label className="row">
            <input
              type="checkbox"
              checked={debug.enabled}
              onChange={(e) => setDebug((d) => ({ ...d, enabled: e.target.checked }))}
            />
            {t(lang, 'debugMode')}
          </label>
          {debug.enabled &&
            persons.map((o) => {
              const a = cameraAngles?.[o.id];
              if (a === undefined) return null;
              return (
                <p key={o.id} className="angle">
                  {facingVsCamera(lang, KIND_TEXT[lang][o.kind].label, a)}
                </p>
              );
            })}
        </section>
      </aside>

      {helpOpen && (
        <div className="modal" onClick={() => setHelpOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{t(lang, 'howTo')}</h2>
            <ul>
              <li>{t(lang, 'helpAdd')}</li>
              <li>{t(lang, 'helpDrag')}</li>
              <li>{t(lang, 'helpShift')}</li>
              <li>{t(lang, 'helpRotate')}</li>
              <li>{t(lang, 'helpOrbit')}</li>
              <li>{t(lang, 'helpSelect')}</li>
              <li>{t(lang, 'helpUndo')}</li>
              <li>{t(lang, 'helpJSON')}</li>
            </ul>
            <button onClick={() => setHelpOpen(false)}>{t(lang, 'close')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
