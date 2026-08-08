import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import * as THREE from 'three';
import './App.css';
import { SceneController } from './scene';
import type { DebugConfig, SceneObjectData } from './scene';
import { CATEGORIES, MODEL_BY_KIND, MODEL_DEFS } from './models';
import type { KindId } from './models';
import { QUESTIONS } from './questions';

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

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let seq = 0;

function createObject(kind: KindId, questionId: number | null): SceneObjectData {
  seq += 1;
  const rnd = mulberry32(seq * 7919 + (questionId ?? 0) * 104729 + 12345);
  let x: number;
  let z: number;
  let rotY: number;
  if (kind === 'school') {
    x = 0;
    z = -4.2;
    rotY = 0;
  } else {
    const angle = rnd() * Math.PI * 2;
    const r = 1.0 + rnd() * 2.8;
    x = Math.cos(angle) * r;
    z = Math.sin(angle) * r;
    rotY = rnd() * Math.PI * 2;
  }
  return { id: `obj-${seq}`, kind, x, y: 0, z, rotY };
}

function reducer(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case 'add': {
      const obj = createObject(action.kind, state.present.questionId);
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
      const objects = question.items.map((kind) => createObject(kind, action.n));
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
}

function parseExport(text: string): { state: SceneState; camera: ExportData['camera'] } {
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
        const { state, camera } = parseExport(String(reader.result));
        dispatch({ type: 'loadJSON', data: state });
        if (camera) {
          controllerRef.current?.setCameraState(
            new THREE.Vector3(camera.x, camera.y, camera.z),
            new THREE.Vector3(camera.tx, camera.ty, camera.tz),
          );
        }
      } catch {
        alert('JSONファイルを読み込めませんでした');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="app">
      <div ref={containerRef} className="stage" />

      <header className="topbar">
        <h1>3D シミュレーション</h1>
        <div className="top-actions">
          <button onClick={() => controllerRef.current?.resetCamera()}>視点リセット</button>
          <button className={rotateMode ? 'active' : ''} onClick={() => setRotateMode((m) => !m)} title="ONにすると左ドラッグで回転">
            回転モード
          </button>
          <button onClick={undo} disabled={past.length === 0} title="元に戻す (Ctrl+Z)">
            戻す
          </button>
          <button onClick={redo} disabled={future.length === 0} title="やり直す (Ctrl+Y)">
            やり直す
          </button>
          <button onClick={downloadJSON}>JSON保存</button>
          <button onClick={() => fileRef.current?.click()}>JSON読込</button>
          <button className="help-btn" onClick={() => setHelpOpen(true)} title="使い方">
            ?
          </button>
        </div>
      </header>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFileChange} />

      <aside className="panel left">
        <h2>道具箱</h2>
        {CATEGORIES.map((cat) => (
          <section key={cat.id}>
            <h3>{cat.label}</h3>
            <div className="items">
              {MODEL_DEFS.filter((d) => d.category === cat.id).map((def) => {
                const count = countByKind.get(def.kind) ?? 0;
                const disabled = count >= def.maxCount;
                return (
                  <button key={def.kind} className="item" disabled={disabled} onClick={() => addItem(def.kind)}>
                    <span className="item-label">{def.label}</span>
                    {def.sub && <span className="item-sub">{def.sub}</span>}
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
          <h2>問題</h2>
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
            シーンをクリア
          </button>
        </section>

        <section>
          <h2>選択中のオブジェクト</h2>
          {selectedObj ? (
            <>
              <p className="sel-name">
                {MODEL_BY_KIND[selectedObj.kind].label}
                {MODEL_BY_KIND[selectedObj.kind].sub ? ` (${MODEL_BY_KIND[selectedObj.kind].sub})` : ''}
              </p>
              <div className="row">
                <button
                  onPointerDown={(e) => startRotateHold(e, -15)}
                  onPointerUp={stopRotateHold}
                  onPointerCancel={stopRotateHold}
                >
                  左回転
                </button>
                <button
                  onPointerDown={(e) => startRotateHold(e, 15)}
                  onPointerUp={stopRotateHold}
                  onPointerCancel={stopRotateHold}
                >
                  右回転
                </button>
              </div>
              <label className="row">
                高さ
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
                <button onClick={snapToGround}>地面に置く</button>
                <button className="danger" onClick={removeSelected}>
                  削除
                </button>
              </div>
            </>
          ) : (
            <p className="muted">オブジェクトをクリックして選択</p>
          )}
        </section>

        <section>
          <h2>計測</h2>
          <label className="row">
            <input
              type="checkbox"
              checked={labelsVisible}
              onChange={(e) => setLabelsVisible(e.target.checked)}
            />
            ラベルを表示
          </label>
          <label className="row">
            <input
              type="checkbox"
              checked={debug.enabled}
              onChange={(e) => setDebug((d) => ({ ...d, enabled: e.target.checked }))}
            />
            デバッグモード
          </label>
          <p className="muted">青線=人物の向き、緑線=カメラの視線方向</p>
          {debug.enabled &&
            persons.map((o) => {
              const a = cameraAngles?.[o.id];
              if (a === undefined) return null;
              return (
                <p key={o.id} className="angle">
                  {MODEL_BY_KIND[o.kind].label} の向き vs カメラ: {a}°
                </p>
              );
            })}
        </section>
      </aside>

      {helpOpen && (
        <div className="modal" onClick={() => setHelpOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>使い方</h2>
            <ul>
              <li>左パネルの「道具箱」から人物や道具をクリックしてシーンに追加します。</li>
              <li>左ドラッグ: 選択中のオブジェクトを地面に沿って移動</li>
              <li>Shift+左ドラッグ: 上下方向にも移動（プレゼントを手に持たせるなど）</li>
              <li>右ドラッグ、または「回転モード」ONで左ドラッグ: その場で回転</li>
              <li>背景での左ドラッグ: 視点の回転 / ホイール: ズーム</li>
              <li>オブジェクトをクリックで選択。右パネルで高さ・回転・削除を操作できます。</li>
              <li>Ctrl+Z: 元に戻す / Ctrl+Y: やり直し</li>
              <li>「JSON保存」でシーン全体を保存。「JSON読込」で再現できます。</li>
            </ul>
            <button onClick={() => setHelpOpen(false)}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}
