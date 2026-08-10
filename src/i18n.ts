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
    undo: '戻す',
    undoTitle: '元に戻す (Ctrl+Z)',
    redo: 'やり直す',
    redoTitle: 'やり直す (Ctrl+Y)',
    saveJSON: '保存',
    loadJSON: '読込',
    help: '使い方',
    toolbox: '道具箱',
    settings: '設定',
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
    helpRotate: '右ドラッグ: その場で回転',
    helpOrbit: '背景での左ドラッグ: 視点の回転 / ホイール: ズーム',
    helpTouch: 'タッチ操作: 1本指で画面の回転や角度の変更、2本指でパン（画面の左右上下への平行移動）やズーム',
    helpSelect: 'オブジェクトをクリックで選択。右パネルで高さ・回転・削除を操作できます。',
    helpUndo: 'Ctrl+Z: 元に戻す / Ctrl+Y: やり直し',
    helpJSON: '「保存」でシーン全体を保存。「読込」で再現できます。',
    close: '閉じる',
    collapsePanel: 'パネルを折りたたむ',
    expandPanel: 'パネルを展開する',
  },
  en: {
    title: '3D Simulation',
    resetView: 'Reset view',
    undo: 'Undo',
    undoTitle: 'Undo (Ctrl+Z)',
    redo: 'Redo',
    redoTitle: 'Redo (Ctrl+Y)',
    saveJSON: 'Save',
    loadJSON: 'Load',
    help: 'How to use',
    toolbox: 'Toolbox',
    settings: 'Settings',
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
    helpRotate: 'Right drag: rotate in place',
    helpOrbit: 'Left drag on the background: rotate the view / wheel: zoom',
    helpTouch: 'Touch: rotate the view with one finger, pan or zoom with two fingers',
    helpSelect: 'Click an object to select it. Adjust height, rotation and deletion in the right panel.',
    helpUndo: 'Ctrl+Z: undo / Ctrl+Y: redo',
    helpJSON: 'Use Save to save the whole scene; Load reproduces it.',
    close: 'Close',
    collapsePanel: 'Collapse panel',
    expandPanel: 'Expand panel',
  },
  sv: {
    title: '3D-simulering',
    resetView: 'Återställ vy',
    undo: 'Ångra',
    undoTitle: 'Ångra (Ctrl+Z)',
    redo: 'Gör om',
    redoTitle: 'Gör om (Ctrl+Y)',
    saveJSON: 'Spara',
    loadJSON: 'Läs in',
    help: 'Så här funkar det',
    toolbox: 'Verktygslåda',
    settings: 'Inställningar',
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
    helpRotate: 'Högerdrag: rotera på plats',
    helpOrbit: 'Vänsterdrag på bakgrunden: rotera vyn / hjul: zooma',
    helpTouch: 'Pek: rotera vyn med ett finger, panorera eller zooma med två fingrar',
    helpSelect: 'Klicka på ett objekt för att välja. Höjd, rotation och radering sköts i högerpanelen.',
    helpUndo: 'Ctrl+Z: ångra / Ctrl+Y: gör om',
    helpJSON: 'Spara sparar hela scenen; Läs in återskapar den.',
    close: 'Stäng',
    collapsePanel: 'Fäll ihop panelen',
    expandPanel: 'Fäll ut panelen',
  },
} as const

export type UIKey = keyof typeof UI.ja

/**
 * Returns the UI string for `key` in the given language.
 * @param lang The language to translate into.
 * @param key The UI string key.
 * @returns The translated string.
 */
export function t(lang: Lang, key: UIKey): string {
  return UI[lang][key]
}

/**
 * Formats a person-facing vs camera angle message.
 * @param lang The language to translate into.
 * @param label The person's display label.
 * @param angle The angle in degrees.
 * @returns The localized "facing vs camera" string.
 */
export function facingVsCamera(lang: Lang, label: string, angle: number): string {
  return t(lang, 'facingVsCamera').replace('{label}', label).replace('{angle}', String(angle))
}

export interface KindText {
  label: string
  sub?: string
  labelText?: string
}

export const KIND_TEXT: Record<Lang, Record<KindId, KindText>> = {
  ja: {
    me: { label: '私', sub: '無地', labelText: '私' },
    you: { label: 'あなた', sub: '斜め縞', labelText: 'あなた' },
    person_a: { label: 'A', sub: '縦縞・帽子', labelText: 'A' },
    person_b: { label: 'B', sub: '水玉・帽子', labelText: 'B' },
    person_c: { label: 'C', sub: 'チェック・帽子', labelText: 'C' },
    family: { label: '家族', sub: '横縞', labelText: '家族' },
    school: { label: '学校' },
    block_tall: { label: '縦ブロック', sub: '' },
    block_flat: { label: '横ブロック', sub: '' },
    present: { label: 'プレゼント' },
    coffee: { label: 'コーヒー', sub: '×2' },
    apple: { label: 'りんご', sub: '×2' },
    cake: { label: 'ケーキ', sub: '×2' },
  },
  en: {
    me: { label: 'Me', sub: 'plain', labelText: 'Me' },
    you: { label: 'You', sub: 'diagonal stripes', labelText: 'You' },
    person_a: { label: 'A', sub: 'vertical stripes・hat', labelText: 'A' },
    person_b: { label: 'B', sub: 'polka dots・hat', labelText: 'B' },
    person_c: { label: 'C', sub: 'check・hat', labelText: 'C' },
    family: { label: 'Family', sub: 'horizontal stripes', labelText: 'Family' },
    school: { label: 'School' },
    block_tall: { label: 'Tall block', sub: '' },
    block_flat: { label: 'Flat block', sub: '' },
    present: { label: 'Present' },
    coffee: { label: 'Coffee', sub: '×2' },
    apple: { label: 'Apple', sub: '×2' },
    cake: { label: 'Cake', sub: '×2' },
  },
  sv: {
    me: { label: 'Jag', sub: 'enfärgad', labelText: 'Jag' },
    you: { label: 'Du', sub: 'diagonalrandig', labelText: 'Du' },
    person_a: { label: 'A', sub: 'lodrätt randig・hatt', labelText: 'A' },
    person_b: { label: 'B', sub: 'prickig・hatt', labelText: 'B' },
    person_c: { label: 'C', sub: 'rutig・hatt', labelText: 'C' },
    family: { label: 'Familj', sub: 'vågrät randig', labelText: 'Familj' },
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
