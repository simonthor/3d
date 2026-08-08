import type { KindId, Category } from './models'

export type Lang = 'ja' | 'en' | 'sv'

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'ja', label: '日本語' },
  { id: 'en', label: 'English' },
  { id: 'sv', label: 'Svenska' },
]

const UI = {
  ja: {
    title: '3D シミュレーション',
    resetView: '視点リセット',
    rotateMode: '回転モード',
    rotateModeTitle: 'ONにすると左ドラッグで回転',
    undo: '戻す',
    undoTitle: '元に戻す (Ctrl+Z)',
    redo: 'やり直す',
    redoTitle: 'やり直す (Ctrl+Y)',
    saveJSON: '保存',
    loadJSON: '読込',
    help: '使い方',
    toolbox: '道具箱',
    questions: '問題',
    clearScene: 'シーンをクリア',
    selectedObject: '選択中のオブジェクト',
    rotateLeft: '左回転',
    rotateRight: '右回転',
    height: '高さ',
    snapToGround: '地面に置く',
    delete: '削除',
    clickToSelect: 'オブジェクトをクリックして選択',
    measurement: '計測',
    showLabels: 'ラベルを表示',
    debugMode: 'デバッグモード',
    facingVsCamera: '{label} の向き vs カメラ: {angle}°',
    loadError: 'JSONファイルを読み込めませんでした',
    howTo: '使い方',
    helpAdd: '左パネルの「道具箱」から人物や道具をクリックしてシーンに追加します。',
    helpDrag: '左ドラッグ: 選択中のオブジェクトを地面に沿って移動',
    helpShift: 'Shift+左ドラッグ: 上下方向にも移動（プレゼントを手に持たせるなど）',
    helpRotate: '右ドラッグ、または「回転モード」ONで左ドラッグ: その場で回転',
    helpOrbit: '背景での左ドラッグ: 視点の回転 / ホイール: ズーム',
    helpSelect: 'オブジェクトをクリックで選択。右パネルで高さ・回転・削除を操作できます。',
    helpUndo: 'Ctrl+Z: 元に戻す / Ctrl+Y: やり直し',
    helpJSON: '「保存」でシーン全体を保存。「読込」で再現できます。',
    close: '閉じる',
  },
  en: {
    title: '3D Simulation',
    resetView: 'Reset view',
    rotateMode: 'Rotate mode',
    rotateModeTitle: 'Left-drag rotates when ON',
    undo: 'Undo',
    undoTitle: 'Undo (Ctrl+Z)',
    redo: 'Redo',
    redoTitle: 'Redo (Ctrl+Y)',
    saveJSON: 'Save',
    loadJSON: 'Load',
    help: 'How to use',
    toolbox: 'Toolbox',
    questions: 'Questions',
    clearScene: 'Clear scene',
    selectedObject: 'Selected object',
    rotateLeft: 'Rotate left',
    rotateRight: 'Rotate right',
    height: 'Height',
    snapToGround: 'Snap to ground',
    delete: 'Delete',
    clickToSelect: 'Click an object to select',
    measurement: 'Measurement',
    showLabels: 'Show labels',
    debugMode: 'Debug mode',
    facingVsCamera: '{label} facing vs camera: {angle}°',
    loadError: 'Could not read the JSON file',
    howTo: 'How to use',
    helpAdd: 'Click people and props in the toolbox on the left to add them to the scene.',
    helpDrag: 'Left drag: move the selected object along the ground',
    helpShift: 'Shift+left drag: also move vertically (e.g. hand a present over)',
    helpRotate: 'Right drag, or left drag with Rotate mode ON: rotate in place',
    helpOrbit: 'Left drag on the background: rotate the view / wheel: zoom',
    helpSelect: 'Click an object to select it. Adjust height, rotation and deletion in the right panel.',
    helpUndo: 'Ctrl+Z: undo / Ctrl+Y: redo',
    helpJSON: 'Use Save to save the whole scene; Load reproduces it.',
    close: 'Close',
  },
  sv: {
    title: '3D-simulering',
    resetView: 'Återställ vy',
    rotateMode: 'Rotationsläge',
    rotateModeTitle: 'Vänsterdrag roterar när PÅ',
    undo: 'Ångra',
    undoTitle: 'Ångra (Ctrl+Z)',
    redo: 'Gör om',
    redoTitle: 'Gör om (Ctrl+Y)',
    saveJSON: 'Spara',
    loadJSON: 'Läs in',
    help: 'Så här funkar det',
    toolbox: 'Verktygslåda',
    questions: 'Frågor',
    clearScene: 'Rensa scenen',
    selectedObject: 'Valt objekt',
    rotateLeft: 'Rotera vänster',
    rotateRight: 'Rotera höger',
    height: 'Höjd',
    snapToGround: 'Lägg på marken',
    delete: 'Ta bort',
    clickToSelect: 'Klicka på ett objekt för att välja',
    measurement: 'Mätning',
    showLabels: 'Visa etiketter',
    debugMode: 'Felsökningsläge',
    facingVsCamera: '{label} riktning vs kamera: {angle}°',
    loadError: 'Kunde inte läsa JSON-filen',
    howTo: 'Så här funkar det',
    helpAdd: 'Klicka på personer och saker i verktygslådan till vänster för att lägga till dem i scenen.',
    helpDrag: 'Vänsterdrag: flytta det valda objektet längs marken',
    helpShift: 'Skift+vänsterdrag: flytta även vertikalt (t.ex. för att räcka en present)',
    helpRotate: 'Högerdrag, eller vänsterdrag med Rotationsläge PÅ: rotera på plats',
    helpOrbit: 'Vänsterdrag på bakgrunden: rotera vyn / hjul: zooma',
    helpSelect: 'Klicka på ett objekt för att välja. Höjd, rotation och radering sköts i högerpanelen.',
    helpUndo: 'Ctrl+Z: ångra / Ctrl+Y: gör om',
    helpJSON: 'Spara sparar hela scenen; Läs in återskapar den.',
    close: 'Stäng',
  },
} as const

export type UIKey = keyof typeof UI.ja

export function t(lang: Lang, key: UIKey): string {
  return UI[lang][key]
}

export function facingVsCamera(lang: Lang, label: string, angle: number): string {
  return t(lang, 'facingVsCamera').replace('{label}', label).replace('{angle}', String(angle))
}

export function langLabel(lang: Lang): string {
  return LANGS.find((l) => l.id === lang)?.label ?? lang
}

export interface KindText {
  label: string
  sub?: string
  labelText?: string
}

export const KIND_TEXT: Record<Lang, Record<KindId, KindText>> = {
  ja: {
    me: { label: '私', sub: 'jag・I', labelText: '私' },
    you: { label: 'あなた', sub: 'du・You', labelText: 'あなた' },
    person_a: { label: 'A', sub: '縞模様・帽子', labelText: 'A' },
    person_b: { label: 'B', sub: '水玉・帽子', labelText: 'B' },
    person_c: { label: 'C', sub: 'チェック・帽子', labelText: 'C' },
    family: { label: '家族', sub: '', labelText: '家族' },
    school: { label: '学校' },
    block_tall: { label: '縦ブロック', sub: '' },
    block_flat: { label: '横ブロック', sub: '' },
    present: { label: 'プレゼント' },
    coffee: { label: 'コーヒー', sub: '×2' },
    apple: { label: 'りんご', sub: '×2' },
    cake: { label: 'ケーキ', sub: '×2' },
  },
  en: {
    me: { label: 'Me', sub: 'jag・I', labelText: 'Me' },
    you: { label: 'You', sub: 'du・You', labelText: 'You' },
    person_a: { label: 'A', sub: 'stripes・hat', labelText: 'A' },
    person_b: { label: 'B', sub: 'polka dots・hat', labelText: 'B' },
    person_c: { label: 'C', sub: 'check・hat', labelText: 'C' },
    family: { label: 'Family', sub: '', labelText: 'Family' },
    school: { label: 'School' },
    block_tall: { label: 'Tall block', sub: '' },
    block_flat: { label: 'Flat block', sub: '' },
    present: { label: 'Present' },
    coffee: { label: 'Coffee', sub: '×2' },
    apple: { label: 'Apple', sub: '×2' },
    cake: { label: 'Cake', sub: '×2' },
  },
  sv: {
    me: { label: 'Jag', sub: 'jag・I', labelText: 'Jag' },
    you: { label: 'Du', sub: 'du・You', labelText: 'Du' },
    person_a: { label: 'A', sub: 'randigt・hatt', labelText: 'A' },
    person_b: { label: 'B', sub: 'prickigt・hatt', labelText: 'B' },
    person_c: { label: 'C', sub: 'rutigt・hatt', labelText: 'C' },
    family: { label: 'Familj', sub: '', labelText: 'Familj' },
    school: { label: 'Skola' },
    block_tall: { label: 'Stående block', sub: '' },
    block_flat: { label: 'Liggande block', sub: '' },
    present: { label: 'Present' },
    coffee: { label: 'Kaffe', sub: '×2' },
    apple: { label: 'Äpple', sub: '×2' },
    cake: { label: 'Tårta', sub: '×2' },
  },
}

export const CATEGORY_TEXT: Record<Lang, Record<Category, string>> = {
  ja: { people: '人物', school: '学校', props: '小物' },
  en: { people: 'People', school: 'School', props: 'Props' },
  sv: { people: 'Personer', school: 'Skola', props: 'Föremål' },
}
