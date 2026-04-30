import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Settings,
  HelpCircle,
  ArrowRight,
  Pencil,
  Send,
  Play,
  Pause,
  Gamepad2,
  Trash2,
  Save,
  FolderOpen,
  Triangle,
  Lock,
  LockOpen,
} from "lucide-react";
import { fetchPreferences, savePreferences } from "./preferencesApi";
import { fetchAuthSession, loginAuthoring, logoutAuthoring } from "./authApi";
import { fetchPuzzlePresets, savePuzzlePresets } from "./puzzlePresetApi";
import { fetchTriangleDebuts, saveTriangleDebuts } from "./triangleDebutApi";
import trypticLogo from "./assets/tryptic-logo.png";
import { bundledPresetPuzzleFiles, bundledTemplateSquares } from "./bundledPuzzles";
import bundledPuzzlePresets from "./puzzlePresets.json";
import bundledTriangleDebuts from "./triangleDebuts.json";

function getBundledPresetPuzzleRaw(fileName) {
  const raw = bundledPresetPuzzleFiles[fileName];
  if (!raw) {
    throw new Error(`Missing bundled puzzle file: ${fileName}`);
  }
  return raw;
}

function getBundledTemplateSquares(fileName) {
  const squares = bundledTemplateSquares[fileName];
  if (!squares) {
    throw new Error(`Missing bundled template file: ${fileName}`);
  }
  return squares;
}

const BUNDLED_PUZZLE_PRESET_RAWS = {
  "triangle-1": { fileName: "SKIP_PAWN_STERN.try" },
  "triangle-2": { fileName: "GUFFAW_GADGET_WART.try" },
  "triangle-3": { fileName: "SCRUB_BLEEP_STOMP.try" },
  "triangle-4": { fileName: "WANING_WANDER_GATOR.try" },
  "triangle-5": { fileName: "BENCH_HALAL_BABEL.try" },
};

const CELL_SIZE = 96;
const BORDER_WIDTH = 6;
const BOUNDARY_SIZE = CELL_SIZE;
const SNAP = CELL_SIZE / 4;
const BOARD_WIDTH = 920;
const BOARD_HEIGHT = 520;
const BOARD_OFFSET_X = 24;
const BOARD_OFFSET_Y = 54;
const GRID_MIN_X = 0;
const GRID_MAX_X = BOARD_WIDTH - BOARD_OFFSET_X * 2 - CELL_SIZE;
const GRID_MIN_Y = 72;
const DEFAULT_GRID_MAX_Y = BOARD_HEIGHT - BOARD_OFFSET_Y * 2 - CELL_SIZE;
const TILE_RADIUS = 18;
const EDITOR_RENDER_SCALE = 0.42;
const CLUE_BOX_HEIGHT = 118;
const CLUE_BOX_WIDTH = 400;
const CLUE_POSITIONS = [84, 262, 520];
const PLAYER_CLUE_STACK_MAX_WIDTH = 440;
const PLAYER_BOARD_CLUE_GAP = 32;
const PLAYER_STACKED_MIN_BOARD_CLUE_GAP = 32;
const PLAYER_STACKED_HINT_TOOLTIP_GAP = 16;
const PLAYER_STACKED_MAX_HINT_SLOT = 168;
const PLAYER_STACKED_BOTTOM_PADDING = 32;
const PLAYER_STACKED_TRIANGLE_SCALE = 0.75;
const PLAYER_STACKED_TRIANGLE_SCALE_BOOST = 1.1;
const PLAYER_STACKED_CLUE_SCALE = 0.95;
const PLAYER_TRIANGLE_CLUE_RATIO = 10 / 12;
const PLAYER_TRIANGLE_CLIP_BUFFER = 18;
const PLAYER_HORIZONTAL_CENTER_LANE_RATIO = 0.27;
const PLAYER_INTERMEDIATE_SCALE = 0.75;
const PLAYER_HORIZONTAL_BASELINE_WIDTH = 1540;
const PLAYER_INTERMEDIATE_START_WIDTH = 1150;
const PLAYER_STACKED_LAYOUT_WIDTH = 820;
const PLAYER_TOP_BAR_HORIZONTAL_PADDING = 28;
const PLAYER_HORIZONTAL_RIGHT_LANE_RATIO = 0.075;
const PLAYER_HORIZONTAL_START_OFFSET = 19;
const HINT_TOOLTIP_VERTICAL_CHROME_PX = 28;
const HINT_TOOLTIP_LINE_HEIGHT_PX = 20;

const DEFAULT_CLUES = [
  {
    text: `“I’LL PASS” (SKI TRIP MISSING AUDIBLE EFFORT) (4)`,
    highlights: [
      { text: "I’LL PASS", type: "definition" },
      { text: "SKI TRIP", type: "fodder" },
      { text: "MISSING AUDIBLE", type: "wordplay" },
      { text: "EFFORT", type: "fodder" },
    ],
  },
  {
    text: `ATTEMPT TO SELL WHISKEY IN PAN (4)`,
    highlights: [
      { text: "ATTEMPT TO SELL", type: "definition" },
      { text: "WHISKEY", type: "fodder" },
      { text: "IN", type: "wordplay" },
      { text: "PAN", type: "fodder" },
    ],
  },
  {
    text: `MOTHERLESS MASTER IN REARMOST PART OF SHIP (5)`,
    highlights: [
      { text: "MOTHERLESS", type: "wordplay" },
      { text: "MASTER IN", type: "fodder" },
      { text: "REARMOST PART OF SHIP", type: "definition" },
    ],
  },
];

const INITIAL_SQUARES = [
  { id: "p", type: "topCorner", x: 264, y: 168, letter: "P" },
  { id: "i", type: "left", x: 168, y: 264, letter: "I" },
  { id: "a", type: "right", x: 360, y: 264, letter: "A" },
  { id: "k", type: "left", x: 120, y: 360, letter: "K" },
  { id: "w", type: "right", x: 408, y: 360, letter: "W" },
  { id: "s", type: "bottomLeftCorner", x: 72, y: 456, letter: "S" },
  { id: "b1", type: "base", x: 168, y: 456, letter: "T" },
  { id: "b2", type: "base", x: 264, y: 456, letter: "E" },
  { id: "b3", type: "base", x: 360, y: 456, letter: "R" },
  { id: "n", type: "bottomRightCorner", x: 456, y: 456, letter: "N" },
];

const SIDE_LABELS = {
  left: "Left",
  right: "Right",
  base: "Base",
  topCorner: "Top",
  bottomLeftCorner: "Bleft",
  bottomRightCorner: "Bright",
};

const SIDE_NAMES = ["left", "right", "base"];

const SIDE_ENDPOINTS = {
  left: { startCorner: "bottomLeft", endCorner: "top" },
  right: { startCorner: "top", endCorner: "bottomRight" },
  base: { startCorner: "bottomLeft", endCorner: "bottomRight" },
};

const SIDE_DISPLAY_LABELS = {
  left: SIDE_LABELS.left,
  right: SIDE_LABELS.right,
  base: SIDE_LABELS.base,
  top: SIDE_LABELS.topCorner,
  bottomLeft: SIDE_LABELS.bottomLeftCorner,
  bottomRight: SIDE_LABELS.bottomRightCorner,
};

const PALETTE_ITEMS = [
  { type: "left", label: "Left", color: "#e9dcff" },
  { type: "right", label: "Right", color: "#d9f4d8" },
  { type: "base", label: "Base", color: "#d9ecff" },
];

const CLUE_SIDE_KEYS = ["left", "right", "base"];

const HINT_SECTIONS = [
  { heading: "Left", items: ["Wordplay", "Fodder", "Definition"] },
  { heading: "Right", items: ["Wordplay", "Fodder", "Definition"] },
  { heading: "Base", items: ["Wordplay", "Fodder", "Definition"] },
];

const HIGHLIGHTER_ITEMS = [
  { id: "wordplay", label: "Wordplay", color: "#ffe97a" },
  { id: "fodder", label: "Fodder", color: "#ffb457" },
  { id: "definition", label: "Definition", color: "#ff7a7a" },
  { id: "clear", label: "Clear", color: null },
];

const HOW_TO_PLAY_SECTIONS = [
  {
    heading: "How to Triumph the Tryptic",
    parenthetical: "How to Play/ Solving",
    items: [],
  },
  {
    heading: "How to Traverse the Triangle",
    parenthetical: "Controls/ Navigation",
    items: [],
  },
];

const TRIUMPH_SUBSECTIONS = ["Clues", "Types of wordplay", "Scoring"];
const TRIUMPH_SUBSECTION_BODY = {
  Clues: [
    "Each clue has three parts.",
    "WORDPLAY which tells you how to play with the\nFODDER to transform it into a synonym for the\nDEFINITION*",
  ],
  "Types of wordplay": [
    "Anagram: rearrange fodder letters",
    "Selection: choose a specific fodder letter(s)",
    "Deletion: remove a letter(s) from fodder",
    "Insertion: put a letter(s) into fodder",
    "Placement: tells you how to situate fodder",
    "Hidden: find a partial answer/full answer hidden in fodder",
    "Container: wrap fodder around other fodder",
    "Reversal: reverse fodder order",
    "Homophone: fodder (or its substitution) should be replaced by a sound-alike",
  ],
  Scoring: [
    "⭐ ⭐ ⭐ The elusive tri-star for those who solved with no help under two minutes!",
    "⭐  A gold star for those who solved with no help.",
    "🔍 💡 Magnifying glasses/ lightbulbs mark reveals/hints used while solving.",
  ],
};
const CLUE_DEFINITION_NOTE = "*Definitions will always be at the beginning or the end of a clue.";

const PLAYER_UI_FONT = '"Tryptic Avenir", "Avenir Next", "Avenir", "Aptos", "Segoe UI", "Helvetica Neue", Helvetica, sans-serif';
const HIGHLIGHT_COLORS = Object.fromEntries(
  HIGHLIGHTER_ITEMS.filter((item) => item.color).map((item) => [item.id, item.color])
);
const PLAYER_BANNER_TARGET_BROWSER_ZOOM = 0.9;
const DARK_MODE_STORAGE_KEY = "triangle-word-game-dark-mode";
const DARK_MODE_DEFAULT_RESET_KEY = "triangle-word-game-dark-mode-default-reset-v1";
const SKIP_HINT_CONFIRM_STORAGE_KEY = "triangle-word-game-skip-hint-confirm";
const SKIP_REVEAL_CONFIRM_STORAGE_KEY = "triangle-word-game-skip-reveal-confirm";
const GAME_SESSION_STORAGE_KEY = "triangle-word-game-session";
const LIVE_GAME_STATE_STORAGE_KEY = "triangle-word-game-live-state";
const LIVE_GAME_TAB_SOURCE_KEY = "triangle-word-game-live-tab-source";
const PUZZLE_PRESETS_STORAGE_KEY = "triangle-word-game-puzzle-presets";
const ENABLE_PREFERENCE_MEMORY = true;
const HINT_TOOLTIP_HOVER_DELAY_MS = 250;
const HINT_TOOLTIP_MOVE_TOLERANCE_PX = 10;
const HINT_TOOLTIP_FONT_SIZE_PX = 15;
const HINT_TOOLTIP_BORDER_CHROME_PX = 4;
const HINT_TOOLTIP_VERTICAL_PADDING_PX = 12;
const HINT_TOOLTIP_HORIZONTAL_PADDING_PX = 16;
const HINT_TOOLTIP_HORIZONTAL_CHROME_PX = 36;
const HINT_TOOLTIP_WIDTH_BUFFER_PX = 6;
const PUZZLE_SCHEMA_VERSION = 1;
const GAME_SESSION_SCHEMA_VERSION = 1;
const DEFAULT_TRIANGLE_DEBUT_HOUR = 6;
const MAX_TRIANGLE_DEBUT_DURATION_MS = 48 * 60 * 60 * 1000;
const PUZZLE_PRESET_SLOTS = [
  { id: "triangle-1", label: "Triangle 1" },
  { id: "triangle-2", label: "Triangle 2" },
  { id: "triangle-3", label: "Triangle 3" },
  { id: "triangle-4", label: "Triangle 4" },
  { id: "triangle-5", label: "Triangle 5" },
];

function isLocalEditorEnvironment() {
  if (typeof window === "undefined") return false;

  const { hostname, protocol } = window.location;
  return (
    protocol === "file:" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

function ModeToggleSpacer({ theme }) {
  return (
    <div
      aria-hidden="true"
      className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full border px-1.5 opacity-0"
      style={{ borderColor: theme.controlBorder, background: theme.controlGroupBg, pointerEvents: "none" }}
    >
      <span className="h-8 w-8 rounded-full" />
      <span className="h-8 w-8 rounded-full" />
    </div>
  );
}

for (const preset of Object.values(BUNDLED_PUZZLE_PRESET_RAWS)) {
  preset.raw = getBundledPresetPuzzleRaw(preset.fileName);
}

function parseDefaultPuzzleFile() {
  try {
    return JSON.parse(BUNDLED_PUZZLE_PRESET_RAWS["triangle-1"].raw);
  } catch {
    return { name: "Untitled Puzzle", puzzle: {} };
  }
}

const DEFAULT_PUZZLE_FILE = parseDefaultPuzzleFile();
const DEFAULT_PUZZLE_NAME =
  typeof DEFAULT_PUZZLE_FILE.name === "string" && DEFAULT_PUZZLE_FILE.name.trim()
    ? DEFAULT_PUZZLE_FILE.name
    : "Untitled Puzzle";

const TRAVERSAL_LEFT_TEMPLATE_SQUARES = getBundledTemplateSquares("5_5_5.try");
const TRAVERSAL_RIGHT_TEMPLATE_SQUARES = getBundledTemplateSquares("6_6_4.try");
const TRAVERSAL_INTERACTIVE_TEMPLATE_SQUARES = getBundledTemplateSquares("4_4_5.try");

let hintTooltipMeasurementContext = null;

function getHintTooltipMeasurementContext({ bold = false } = {}) {
  if (typeof document === "undefined") return null;
  if (!hintTooltipMeasurementContext) {
    hintTooltipMeasurementContext = document.createElement("canvas").getContext("2d");
  }
  if (hintTooltipMeasurementContext) {
    hintTooltipMeasurementContext.font = `${bold ? 600 : 400} ${HINT_TOOLTIP_FONT_SIZE_PX}px ${PLAYER_UI_FONT}`;
  }
  return hintTooltipMeasurementContext;
}

function measureHintTooltipText(text, { bold = false } = {}) {
  const context = getHintTooltipMeasurementContext({ bold });
  if (!context) return String(text || "").length * HINT_TOOLTIP_FONT_SIZE_PX * 0.55;
  return context.measureText(text).width;
}

function measureHintTooltipSegments(segments) {
  return segments.reduce(
    (width, segment) => width + measureHintTooltipText(segment.text, { bold: segment.bold }),
    0
  );
}

function renderWordplayExplanation(line) {
  const text = String(line || "");
  const colonIndex = text.indexOf(":");

  if (colonIndex === -1) return text;

  const title = text.slice(0, colonIndex).trim();
  const body = text.slice(colonIndex + 1).trim();

  return (
    <>
      <span className="font-semibold" style={{ color: "var(--tryptic-strong-text, rgba(0,0,0,0.78))" }}>
        {title}:
      </span>
      {body ? ` ${body}` : ""}
    </>
  );
}

function renderCluePartsExplanation(line) {
  const text = String(line || "");
  const highlightedTerms = new Set(["WORDPLAY", "FODDER", "DEFINITION"]);
  const segments = text.split(/(WORDPLAY|FODDER|DEFINITION|\n)/g);

  return segments.map((segment, index) =>
    segment === "\n" ? (
      <br key={`line-break-${index}`} />
    ) : highlightedTerms.has(segment) ? (
      <span
        key={`${segment}-${index}`}
        className="font-semibold"
        style={{ color: "var(--tryptic-strong-text, rgba(0,0,0,0.78))" }}
      >
        {segment}
      </span>
    ) : (
      <Fragment key={`${segment}-${index}`}>{segment}</Fragment>
    )
  );
}

function renderTriStarIcon() {
  return (
    <span className="inline-flex flex-col items-center justify-center text-[0.95em] leading-none align-[-0.18em]">
      <span>⭐</span>
      <span className="mt-[0.05em] flex items-center justify-center gap-[0.18em]">
        <span>⭐</span>
        <span>⭐</span>
      </span>
    </span>
  );
}

function renderScoringExplanation(line) {
  const text = String(line || "");

  if (text.startsWith("⭐ ⭐ ⭐ ")) {
    return (
      <span className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3">
        <span className="flex justify-center">{renderTriStarIcon()}</span>
        <span>{text.slice("⭐ ⭐ ⭐ ".length)}</span>
      </span>
    );
  }

  if (text.startsWith("⭐")) {
    return (
      <span className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3">
        <span className="flex justify-center text-[1.05em] leading-none">⭐</span>
        <span>{text.slice(1).trimStart()}</span>
      </span>
    );
  }

  if (text.startsWith("🔍 💡 ")) {
    return (
      <span className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3">
        <span className="flex justify-center text-[1.05em] leading-none">🔍 💡</span>
        <span>{text.slice("🔍 💡 ".length)}</span>
      </span>
    );
  }

  return text;
}

function getHintTooltipSegments(text) {
  const source = String(text || "");
  const segments = [];
  const boldRanges = [];
  const bracketPattern = /\[[^\[\]]+\]/g;
  const quotePattern = /"[^"]+"|“[^”]+”/g;
  let match = bracketPattern.exec(source);

  while (match) {
    boldRanges.push({ start: match.index, end: match.index + match[0].length });
    match = bracketPattern.exec(source);
  }

  match = quotePattern.exec(source);
  while (match) {
    boldRanges.push({ start: match.index, end: match.index + match[0].length });
    match = quotePattern.exec(source);
  }

  boldRanges.sort((a, b) => a.start - b.start || b.end - a.end);

  let cursor = 0;
  boldRanges.forEach((range) => {
    if (range.end <= cursor) return;
    const start = Math.max(range.start, cursor);

    if (start > cursor) {
      segments.push({ text: source.slice(cursor, start), bold: false });
    }

    segments.push({ text: source.slice(start, range.end), bold: true });
    cursor = range.end;
  });

  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), bold: false });
  }

  return segments.length ? segments : [{ text: source, bold: false }];
}

function getHintTooltipOuterWidth(hintSegments, maxOuterWidth) {
  const naturalOuterWidth =
    measureHintTooltipSegments(hintSegments) + HINT_TOOLTIP_HORIZONTAL_CHROME_PX + HINT_TOOLTIP_WIDTH_BUFFER_PX;
  return Math.min(maxOuterWidth, Math.ceil(naturalOuterWidth));
}

function getHintTooltipLineCount(hintSegments, outerWidth, fontScale = 1) {
  const horizontalChrome =
    HINT_TOOLTIP_BORDER_CHROME_PX + HINT_TOOLTIP_HORIZONTAL_PADDING_PX * 2 * fontScale;
  const contentWidth = Math.max(outerWidth - horizontalChrome, HINT_TOOLTIP_FONT_SIZE_PX * 6 * fontScale);
  let lineCount = 1;
  let lineWidth = 0;
  const pushToken = (token, bold) => {
    const tokenWidth = measureHintTooltipText(token, { bold }) * fontScale;
    if (lineWidth > 0 && lineWidth + tokenWidth > contentWidth) {
      lineCount += 1;
      lineWidth = tokenWidth;
      return;
    }
    lineWidth += tokenWidth;
  };

  hintSegments.forEach((segment) => {
    String(segment.text || "")
      .split(/(\s+)/)
      .filter(Boolean)
      .forEach((token) => pushToken(token, segment.bold));
  });

  return lineCount;
}

function getHintTooltipRenderedHeight(hintSegments, outerWidth, fontScale = 1) {
  const lineCount = getHintTooltipLineCount(hintSegments, outerWidth, fontScale);
  return (
    lineCount * HINT_TOOLTIP_LINE_HEIGHT_PX * fontScale +
    HINT_TOOLTIP_VERTICAL_PADDING_PX * 2 * fontScale +
    HINT_TOOLTIP_BORDER_CHROME_PX
  );
}

function getHintTooltipEstimatedHeight(hintSegments, outerWidth) {
  return getHintTooltipRenderedHeight(hintSegments, outerWidth, 1);
}

function getHintTooltipFontScaleForSlot(hintSegments, outerWidth, availableTooltipHeight) {
  if (getHintTooltipRenderedHeight(hintSegments, outerWidth, 1) <= availableTooltipHeight) return 1;

  let low = 0;
  let high = 1;
  for (let i = 0; i < 10; i += 1) {
    const midpoint = (low + high) / 2;
    if (getHintTooltipRenderedHeight(hintSegments, outerWidth, midpoint) <= availableTooltipHeight) {
      low = midpoint;
    } else {
      high = midpoint;
    }
  }

  return low;
}

function buildEmptyHints() {
  return {
    wordplay: "",
    fodder: "",
    definition: "",
  };
}

function sanitizeLetter(value) {
  return String(value || "")
    .slice(-1)
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function slugifyPuzzleName(name) {
  const slug = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `puzzle-${Date.now()}`;
}

function sanitizePuzzleFileStem(name) {
  const cleaned = String(name || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();

  return cleaned || "Untitled Puzzle";
}

function puzzleFileNameFromName(name) {
  return `${sanitizePuzzleFileStem(name)}.try`;
}

function puzzleNameFromFileName(fileName) {
  return String(fileName || "")
    .replace(/\.try$/i, "")
    .trim() || "Untitled Puzzle";
}

function isAbortError(error) {
  return error instanceof Error && error.name === "AbortError";
}

function supportsNativeFilePickers() {
  return typeof window !== "undefined" && "showSaveFilePicker" in window && "showOpenFilePicker" in window;
}

function shouldOpenHowToPlayFromUrl() {
  if (typeof window === "undefined") return false;
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("view") === "how-to-play";
}

function syncHowToPlayUrl(isOpen) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);

  if (isOpen) {
    url.searchParams.set("view", "how-to-play");
  } else {
    url.searchParams.delete("view");
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.pushState(null, "", nextUrl);
  }
}

function readStoredBoolean(key) {
  if (!ENABLE_PREFERENCE_MEMORY) return false;
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(key) === "true";
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clueTextToHtml(text) {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function buildHighlightedClueHtml(text, highlights = []) {
  const safeText = text || "";
  if (!highlights.length) return clueTextToHtml(safeText);

  const markers = [];
  const usedRanges = [];

  highlights.forEach(({ text: fragment, type }) => {
    if (!fragment || !type) return;
    const start = safeText.indexOf(fragment);
    if (start === -1) return;
    const end = start + fragment.length;
    if (usedRanges.some((range) => !(end <= range.start || start >= range.end))) return;
    usedRanges.push({ start, end });
    markers.push({ start, end, type });
  });

  markers.sort((a, b) => a.start - b.start);

  let cursor = 0;
  let html = "";

  markers.forEach(({ start, end, type }) => {
    html += clueTextToHtml(safeText.slice(cursor, start));
    html += `<span data-highlight-type="${escapeHtml(type)}" style="background-color: ${escapeHtml(
      HIGHLIGHT_COLORS[type] || "transparent"
    )}; border-radius: 0.28em; padding: 0;">${clueTextToHtml(safeText.slice(start, end))}</span>`;
    cursor = end;
  });

  html += clueTextToHtml(safeText.slice(cursor));
  return html;
}

function decodeHtml(html) {
  if (typeof document === "undefined") {
    return html;
  }

  const textarea = document.createElement("textarea");
  textarea.innerHTML = html;
  return textarea.value;
}

function clueHtmlToPlainText(html) {
  const withLineBreaks = html
    .replace(/<div><br><\/div>/gi, "\n")
    .replace(/<\/div>\s*<div>/gi, "\n")
    .replace(/<div>/gi, "")
    .replace(/<\/div>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/gi, " ");

  return decodeHtml(withLineBreaks.replace(/<[^>]+>/g, ""));
}

function stripEditorOnlyInlineStyles(node) {
  if (!(node instanceof HTMLElement)) return;

  node.style.removeProperty("background");
  node.style.removeProperty("background-color");
  node.style.removeProperty("border-radius");
  node.style.removeProperty("padding");
  node.style.removeProperty("margin");
  node.style.removeProperty("display");
  node.style.removeProperty("vertical-align");
  node.style.removeProperty("box-decoration-break");
  node.style.removeProperty("-webkit-box-decoration-break");

  if (!node.getAttribute("style")?.trim()) {
    node.removeAttribute("style");
  }
}

function clueHtmlToPlayerHtml(html) {
  if (!html || typeof document === "undefined") return html || "";

  const template = document.createElement("template");
  template.innerHTML = html;

  Array.from(template.content.querySelectorAll("[style]")).forEach(stripEditorOnlyInlineStyles);

  Array.from(template.content.querySelectorAll("[data-highlight-type]")).forEach((node) => {
    const type = node.getAttribute("data-highlight-type");
    node.removeAttribute("style");
    node.removeAttribute("data-highlight-type");
    if (type) node.classList.add(`player-highlight-${type}`);
  });

  return template.innerHTML;
}

function clueHtmlToFilteredPlayerHtml(html, allowedTypes = []) {
  if (!html || typeof document === "undefined") return html || "";

  const allowed = new Set(allowedTypes);
  const template = document.createElement("template");
  template.innerHTML = html;

  Array.from(template.content.querySelectorAll("[style]")).forEach(stripEditorOnlyInlineStyles);

  Array.from(template.content.querySelectorAll("[data-highlight-type]")).forEach((node) => {
    const type = node.getAttribute("data-highlight-type");
    if (!type || !allowed.has(type)) {
      unwrapHighlightSpan(node);
      return;
    }

    node.removeAttribute("style");
    node.setAttribute("data-player-highlight-type", type);
    node.removeAttribute("data-highlight-type");
    node.classList.add(`player-highlight-${type}`);
  });

  return template.innerHTML;
}

function normalizeCluePlainText(text) {
  return (text || "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function buildClueState(input) {
  const source = typeof input === "string" ? { text: input, highlights: [] } : input;
  const derivedText = source?.plainText || source?.text || clueHtmlToPlainText(source?.html || "");
  const normalizedText = normalizeCluePlainText(derivedText || "");
  return {
    html:
      typeof source?.html === "string" && source.html
        ? source.html
        : buildHighlightedClueHtml(normalizedText, source?.highlights || []),
    plainText: normalizedText,
    hints: {
      ...buildEmptyHints(),
      ...(source?.hints || {}),
    },
  };
}

function sanitizeSquare(square, index) {
  return {
    id:
      typeof square?.id === "string" && square.id.trim()
        ? square.id
        : `sq_${index}_${Math.random().toString(36).slice(2, 7)}`,
    type: typeof square?.type === "string" && square.type ? square.type : "base",
    x: Number.isFinite(square?.x) ? square.x : 0,
    y: Number.isFinite(square?.y) ? square.y : 0,
    letter: sanitizeLetter(square?.letter),
  };
}

function serializePuzzleState(squares, clues) {
  return {
    version: PUZZLE_SCHEMA_VERSION,
    squares: squares.map((square) => sanitizeSquare(square)),
    clues: clues.map((clue) => {
      const html = typeof clue?.html === "string" ? clue.html : "";
      const plainText = normalizeCluePlainText(clue?.plainText || clueHtmlToPlainText(html));
      return {
        html,
        plainText,
        hints: {
          ...buildEmptyHints(),
          ...(clue?.hints || {}),
        },
      };
    }),
  };
}

function normalizePuzzleState(puzzle) {
  const source = puzzle && typeof puzzle === "object" ? puzzle : {};
  const squares = Array.isArray(source.squares) ? source.squares.map(sanitizeSquare) : [];
  const uniqueSquares = [];
  const seenIds = new Set();

  squares.forEach((square) => {
    if (seenIds.has(square.id)) return;
    seenIds.add(square.id);
    uniqueSquares.push(square);
  });

  return {
    squares: uniqueSquares.length ? uniqueSquares : INITIAL_SQUARES,
    clues: CLUE_SIDE_KEYS.map((_, index) => buildClueState(source.clues?.[index] || DEFAULT_CLUES[index])),
  };
}

const DEFAULT_PUZZLE_STATE = normalizePuzzleState(DEFAULT_PUZZLE_FILE.puzzle);

function sanitizePuzzlePresetEntry(entry) {
  if (!entry || typeof entry !== "object") return null;

  try {
    const normalizedPuzzle = normalizePuzzleState(entry.puzzle);
    return {
      name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : "Untitled Puzzle",
      fileName: typeof entry.fileName === "string" && entry.fileName.trim() ? entry.fileName.trim() : "",
      puzzle: serializePuzzleState(normalizedPuzzle.squares, normalizedPuzzle.clues),
      updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function parseBundledPuzzlePreset({ fileName, raw }) {
  try {
    const parsed = JSON.parse(raw);
    return sanitizePuzzlePresetEntry({
      name: parsed?.name || puzzleNameFromFileName(fileName),
      fileName,
      puzzle: parsed?.puzzle ?? parsed,
      updatedAt: "bundled",
    });
  } catch {
    return null;
  }
}

const BUILT_IN_PUZZLE_PRESETS = Object.fromEntries(
  PUZZLE_PRESET_SLOTS.map((slot) => [slot.id, parseBundledPuzzlePreset(BUNDLED_PUZZLE_PRESET_RAWS[slot.id])]).filter(
    ([, preset]) => Boolean(preset)
  )
);

const BUNDLED_REPO_PUZZLE_PRESETS = Object.fromEntries(
  PUZZLE_PRESET_SLOTS.map((slot) => [slot.id, sanitizePuzzlePresetEntry(bundledPuzzlePresets?.[slot.id])]).filter(
    ([, preset]) => Boolean(preset)
  )
);

function readStoredPuzzlePresets() {
  if (typeof window === "undefined") return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(PUZZLE_PRESETS_STORAGE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object") return {};

    return Object.fromEntries(
      PUZZLE_PRESET_SLOTS.map((slot) => [slot.id, sanitizePuzzlePresetEntry(parsed[slot.id])]).filter(
        ([, preset]) => Boolean(preset)
      )
    );
  } catch {
    return {};
  }
}

function readPuzzlePresets() {
  return {
    ...BUILT_IN_PUZZLE_PRESETS,
    ...BUNDLED_REPO_PUZZLE_PRESETS,
    ...readStoredPuzzlePresets(),
  };
}

function writeStoredPuzzlePresets(presets) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PUZZLE_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Keep the current in-memory presets even if browser storage is unavailable.
  }
}

function formatDateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTimeInputValue(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function buildDefaultTriangleDebutInputs(now = new Date()) {
  const next = new Date(now);
  if (
    next.getHours() > DEFAULT_TRIANGLE_DEBUT_HOUR ||
    (next.getHours() === DEFAULT_TRIANGLE_DEBUT_HOUR && next.getMinutes() > 0)
  ) {
    next.setDate(next.getDate() + 1);
  }
  next.setHours(DEFAULT_TRIANGLE_DEBUT_HOUR, 0, 0, 0);
  return {
    date: formatDateInputValue(next),
    time: formatTimeInputValue(next),
  };
}

function buildLocalDateFromInputs(dateValue, timeValue = "06:00") {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ""));
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(String(timeValue || ""));
  if (!dateMatch || !timeMatch) return null;

  const [, year, month, day] = dateMatch;
  const [, hours, minutes] = timeMatch;
  const result = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    0,
    0
  );

  if (
    Number.isNaN(result.getTime()) ||
    result.getFullYear() !== Number(year) ||
    result.getMonth() !== Number(month) - 1 ||
    result.getDate() !== Number(day)
  ) {
    return null;
  }

  return result;
}

function formatDebutDateTimeLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getDebutDisplayName(entry) {
  if (entry?.fileName && String(entry.fileName).trim()) return String(entry.fileName).trim();
  if (entry?.name && String(entry.name).trim()) return String(entry.name).trim();
  return "Untitled Puzzle";
}

function doDebutRangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function sanitizeTriangleDebutEntry(entry) {
  const sanitizedPreset = sanitizePuzzlePresetEntry(entry);
  if (!sanitizedPreset) return null;

  const startsAt = typeof entry?.startsAt === "string" ? new Date(entry.startsAt) : null;
  const endsAt = typeof entry?.endsAt === "string" ? new Date(entry.endsAt) : null;
  if (!startsAt || !endsAt || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return null;

  const durationMs = endsAt.getTime() - startsAt.getTime();
  if (durationMs <= 0 || durationMs > MAX_TRIANGLE_DEBUT_DURATION_MS) return null;

  return {
    ...sanitizedPreset,
    id:
      typeof entry?.id === "string" && entry.id.trim()
        ? entry.id
        : `debut-${startsAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}

function sortTriangleDebuts(entries) {
  return [...entries].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

function readBundledTriangleDebuts() {
  const now = Date.now();
  return sortTriangleDebuts(
    (Array.isArray(bundledTriangleDebuts) ? bundledTriangleDebuts : [])
      .map((entry) => sanitizeTriangleDebutEntry(entry))
      .filter((entry) => Boolean(entry) && new Date(entry.endsAt).getTime() > now)
  );
}

function getActiveTriangleDebut(entries, now = Date.now()) {
  return [...entries]
    .reverse()
    .find((entry) => {
      const start = new Date(entry.startsAt).getTime();
      const end = new Date(entry.endsAt).getTime();
      return start <= now && now < end;
    }) || null;
}

function getInitialPuzzleSource() {
  return getActiveTriangleDebut(readBundledTriangleDebuts()) || readPuzzlePresets()[PUZZLE_PRESET_SLOTS[0].id] || null;
}

function buildLivePuzzleSourceDescriptor(activeDebut, presets) {
  if (activeDebut) {
    return {
      kind: "live",
      sourceKey: [
        "live",
        "debut",
        activeDebut.id,
        activeDebut.updatedAt || "",
        activeDebut.startsAt,
        activeDebut.endsAt,
      ].join(":"),
      name: activeDebut.name || "Untitled Puzzle",
      puzzle: normalizePuzzleState(activeDebut.puzzle),
    };
  }

  const fallbackPreset = presets?.[PUZZLE_PRESET_SLOTS[0].id] || null;
  if (fallbackPreset) {
    return {
      kind: "live",
      sourceKey: [
        "live",
        "fallback",
        PUZZLE_PRESET_SLOTS[0].id,
        fallbackPreset.updatedAt || "",
        fallbackPreset.fileName || "",
        fallbackPreset.name || "",
      ].join(":"),
      name: fallbackPreset.name || PUZZLE_PRESET_SLOTS[0].label,
      puzzle: normalizePuzzleState(fallbackPreset.puzzle),
    };
  }

  return {
    kind: "live",
    sourceKey: "live:fallback:built-in",
    name: DEFAULT_PUZZLE_NAME,
    puzzle: DEFAULT_PUZZLE_STATE,
  };
}

function buildInitialPuzzleSourceDescriptor() {
  return buildLivePuzzleSourceDescriptor(getActiveTriangleDebut(readBundledTriangleDebuts()), readPuzzlePresets());
}

function buildPlaytestPuzzleSourceDescriptor(slot, preset) {
  return {
    kind: "playtest",
    sourceKey: [
      "playtest",
      slot.id,
      preset?.updatedAt || "",
      preset?.fileName || "",
      preset?.name || slot.label,
    ].join(":"),
  };
}

function buildEditorPuzzleSourceDescriptor(name = "Untitled Puzzle") {
  return {
    kind: "editor",
    sourceKey: `editor:${name}`,
  };
}

function getInitialPuzzleState() {
  const defaultPreset = getInitialPuzzleSource();
  return defaultPreset ? normalizePuzzleState(defaultPreset.puzzle) : DEFAULT_PUZZLE_STATE;
}

function getInitialPuzzleName() {
  const defaultPreset = getInitialPuzzleSource();
  return defaultPreset?.name || DEFAULT_PUZZLE_NAME;
}

function buildInitialBootState() {
  const initialSource = buildInitialPuzzleSourceDescriptor();
  const initialPuzzleState = initialSource?.puzzle || DEFAULT_PUZZLE_STATE;
  return {
    puzzleSource: initialSource,
    puzzleState: initialPuzzleState,
    puzzleName: initialSource?.name || DEFAULT_PUZZLE_NAME,
  };
}

function buildBlankPlayerLetters(squares) {
  return Object.fromEntries(squares.map((sq) => [sq.id, ""]));
}

function sanitizeAssistLog(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.filter(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      typeof entry.type === "string" &&
      typeof entry.scope === "string"
  );
}

function normalizePlayerLettersSnapshot(playerLetters, squares) {
  const blankLetters = buildBlankPlayerLetters(squares);
  const source = playerLetters && typeof playerLetters === "object" ? playerLetters : {};

  return Object.fromEntries(
    squares.map((sq) => [sq.id, sanitizeLetter(source[sq.id] || blankLetters[sq.id] || "")])
  );
}

function normalizeGameSessionSnapshot(snapshot, { allowEditorMode = false } = {}) {
  if (!snapshot || typeof snapshot !== "object") return null;
  if (snapshot.version !== GAME_SESSION_SCHEMA_VERSION) return null;

  const normalizedPuzzle = normalizePuzzleState(snapshot.puzzle);
  const sanitizedFinishedState =
    snapshot.finishedState === "solved" || snapshot.finishedState === "revealed" ? snapshot.finishedState : null;

  return {
    squares: normalizedPuzzle.squares,
    clues: normalizedPuzzle.clues,
    playerLetters: normalizePlayerLettersSnapshot(snapshot.playerLetters, normalizedPuzzle.squares),
    seconds: Number.isFinite(snapshot.seconds) ? Math.max(0, snapshot.seconds) : 0,
    hasStartedGame: Boolean(snapshot.hasStartedGame),
    showStartModal: Boolean(snapshot.showStartModal),
    isPaused: Boolean(snapshot.isPaused),
    mode: allowEditorMode && snapshot.mode === "editor" ? "editor" : "player",
    showSolvedModal: Boolean(snapshot.showSolvedModal),
    finishedState: sanitizedFinishedState,
    assistLog: sanitizeAssistLog(snapshot.assistLog),
    finishAssistLog: sanitizeAssistLog(snapshot.finishAssistLog),
    selectedId:
      typeof snapshot.selectedId === "string" &&
      normalizedPuzzle.squares.some((sq) => sq.id === snapshot.selectedId)
        ? snapshot.selectedId
        : snapshot.selectedId === null
          ? null
          : getPreferredSelectedSquareId(normalizedPuzzle.squares),
    lastSide: SIDE_NAMES.includes(snapshot.lastSide) ? snapshot.lastSide : "base",
    currentPuzzleName:
      typeof snapshot.currentPuzzleName === "string" && snapshot.currentPuzzleName.trim()
        ? snapshot.currentPuzzleName
        : "Untitled Puzzle",
    selectedDebutId:
      allowEditorMode && typeof snapshot.selectedDebutId === "string" && snapshot.selectedDebutId.trim()
        ? snapshot.selectedDebutId
        : null,
    debutDateInput:
      allowEditorMode && typeof snapshot.debutDateInput === "string" ? snapshot.debutDateInput : "",
    debutTimeInput:
      allowEditorMode && typeof snapshot.debutTimeInput === "string" ? snapshot.debutTimeInput : "",
    selectedDebutFileName:
      allowEditorMode && typeof snapshot.selectedDebutFileName === "string" ? snapshot.selectedDebutFileName : "",
    showWelcomeBackModal: Boolean(snapshot.showWelcomeBackModal),
    puzzleSourceKind:
      snapshot.puzzleSourceKind === "live" ||
      snapshot.puzzleSourceKind === "playtest" ||
      snapshot.puzzleSourceKind === "editor"
        ? snapshot.puzzleSourceKind
        : null,
    puzzleSourceKey:
      typeof snapshot.puzzleSourceKey === "string" && snapshot.puzzleSourceKey.trim()
        ? snapshot.puzzleSourceKey
        : null,
  };
}

function hasAssistEntry(entries, candidate) {
  return entries.some((entry) => entry.type === candidate.type && entry.scope === candidate.scope);
}

function getAssistTimelineSymbols(entries, solvedModalStars) {
  const timeline = entries.map((entry) => (entry.type === "hint" ? "💡" : "🔎"));

  if (!timeline.length) {
    return solvedModalStars ? [solvedModalStars] : [];
  }

  return timeline;
}

function unwrapHighlightSpan(span) {
  const parent = span.parentNode;
  if (!parent) return;

  while (span.firstChild) {
    parent.insertBefore(span.firstChild, span);
  }

  parent.removeChild(span);
}

function collectIntersectingHighlights(editor, range) {
  return Array.from(editor.querySelectorAll("[data-highlight-type]")).filter((span) =>
    range.intersectsNode(span)
  );
}

function normalizeCssColor(color) {
  if (typeof document === "undefined") return color;
  const sample = document.createElement("span");
  sample.style.color = color;
  document.body.appendChild(sample);
  const normalized = window.getComputedStyle(sample).color;
  document.body.removeChild(sample);
  return normalized;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function getClueFontSize(clue, width = 420, height = 150) {
  const lines = (clue || "").split("\n");
  const maxLineLen = Math.max(...lines.map((l) => l.trim().length), 0);
  const lineCount = lines.length;

  let size = 24;
  if (maxLineLen <= 22 && lineCount <= 2) size = 26;
  else if (maxLineLen <= 28 && lineCount <= 2) size = 24;
  else if (maxLineLen <= 34 && lineCount <= 3) size = 22;
  else if (maxLineLen <= 42 && lineCount <= 3) size = 20;
  else size = 18;

  if (width < 420) size -= 2;
  if (width < 380) size -= 2;
  if (height < 160) size -= 1;

  return Math.max(16, size);
}

function AutoFitClueText({ text, html, fontFamily, fixedFontSize, highlightStyles, richTextClassName }) {
  const ref = useRef(null);
  const sizeText = text ?? clueHtmlToPlainText(html || "");
  const [fontSize, setFontSize] = useState(() => getClueFontSize(sizeText));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const updateSize = () => {
      if (fixedFontSize) {
        setFontSize(fixedFontSize);
        return;
      }

      let size = getClueFontSize(sizeText, el.clientWidth, el.clientHeight);
      el.style.fontSize = `${size}px`;

      const fits = () => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight;

      while (size > 14 && !fits()) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }

      setFontSize(size);
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fixedFontSize, html, sizeText]);

  return (
    <div
      ref={ref}
      className="w-full h-full whitespace-pre-line flex items-center justify-center text-center"
      style={{
        fontSize: `${fixedFontSize ? fontSize + 1 : fontSize}px`,
        fontWeight: 600,
        lineHeight: 1.16,
        letterSpacing: "-0.02em",
        fontFamily,
        textTransform: "uppercase",
        overflow: "hidden",
        userSelect: "text",
        WebkitUserSelect: "text",
      }}
    >
      {highlightStyles ? <style>{highlightStyles}</style> : null}
      {html ? <div className={richTextClassName} dangerouslySetInnerHTML={{ __html: html }} /> : text}
    </div>
  );
}

function MiniClueBoxExample({ theme, fontFamily, fixedFontSize, highlightStyles }) {
  const [hoveredHintType, setHoveredHintType] = useState(null);
  const exampleHintTimeoutRef = useRef(null);
  const miniClueFontSize = Math.max(15, Math.round((fixedFontSize + 1) * 0.88));
  const hintTextByType = {
    wordplay: 'The wordplay is "WORDPLAY," signaling what to do etc... [type of wordplay].',
    fodder: 'The fodder is "FODDER."',
    definition: 'The definition is "DEFINITION."',
  };
  const hoveredHintText = hoveredHintType ? hintTextByType[hoveredHintType] : "";
  const hoveredHintSegments = getHintTooltipSegments(hoveredHintText);

  useEffect(
    () => () => {
      if (exampleHintTimeoutRef.current) {
        clearTimeout(exampleHintTimeoutRef.current);
      }
    },
    []
  );

  const showHintType = (type, { immediate = false } = {}) => {
    if (exampleHintTimeoutRef.current) {
      clearTimeout(exampleHintTimeoutRef.current);
      exampleHintTimeoutRef.current = null;
    }

    if (immediate) {
      setHoveredHintType(type);
      return;
    }

    exampleHintTimeoutRef.current = setTimeout(() => {
      setHoveredHintType(type);
      exampleHintTimeoutRef.current = null;
    }, HINT_TOOLTIP_HOVER_DELAY_MS);
  };

  const hideHintType = (type) => {
    if (exampleHintTimeoutRef.current) {
      clearTimeout(exampleHintTimeoutRef.current);
      exampleHintTimeoutRef.current = null;
    }

    setHoveredHintType((current) => (current === type ? null : current));
  };

  const handleHintPointerMove = (event, type) => {
    if (!hoveredHintType || hoveredHintType === type) return;
    if (exampleHintTimeoutRef.current) return;
    setHoveredHintType(type);
  };

  const renderHintSegments = (segments) =>
    segments.map((segment, index) =>
      segment.bold ? (
        <strong key={`${index}-${segment.text}`} style={{ fontWeight: 600 }}>
          {segment.text}
        </strong>
      ) : (
        <Fragment key={`${index}-${segment.text}`}>{segment.text}</Fragment>
      )
    );

  return (
    <div className="relative w-full max-w-[340px] pb-[86px]">
      <style>{highlightStyles}</style>
      <div
        className="flex min-h-[104px] w-full items-center justify-center rounded-[24px] px-6 py-4 text-center"
        style={{ background: theme.clueActiveBg, color: theme.text }}
      >
        <div
          className="player-clue-rich player-clue-rich-active font-semibold uppercase tracking-[-0.02em]"
          style={{
            fontFamily,
            fontSize: `${miniClueFontSize}px`,
            fontWeight: 600,
            lineHeight: 1.16,
          }}
        >
          <span
            tabIndex={0}
            className="player-highlight-definition outline-none ring-black/0 transition-shadow focus-visible:ring-2 focus-visible:ring-black/35"
            data-player-highlight-type="definition"
            onMouseEnter={() => showHintType("definition")}
            onMouseMove={(event) => handleHintPointerMove(event, "definition")}
            onMouseLeave={() => hideHintType("definition")}
            onFocus={() => showHintType("definition", { immediate: true })}
            onBlur={() => hideHintType("definition")}
          >
            DEFINITION
          </span>{" "}
          <span
            tabIndex={0}
            className="player-highlight-wordplay outline-none ring-black/0 transition-shadow focus-visible:ring-2 focus-visible:ring-black/35"
            data-player-highlight-type="wordplay"
            onMouseEnter={() => showHintType("wordplay")}
            onMouseMove={(event) => handleHintPointerMove(event, "wordplay")}
            onMouseLeave={() => hideHintType("wordplay")}
            onFocus={() => showHintType("wordplay", { immediate: true })}
            onBlur={() => hideHintType("wordplay")}
          >
            WORDPLAY
          </span>{" "}
          <span
            tabIndex={0}
            className="player-highlight-fodder outline-none ring-black/0 transition-shadow focus-visible:ring-2 focus-visible:ring-black/35"
            data-player-highlight-type="fodder"
            onMouseEnter={() => showHintType("fodder")}
            onMouseMove={(event) => handleHintPointerMove(event, "fodder")}
            onMouseLeave={() => hideHintType("fodder")}
            onFocus={() => showHintType("fodder", { immediate: true })}
            onBlur={() => hideHintType("fodder")}
          >
            FODDER
          </span>{" "}
          (#)
        </div>
      </div>
      {hoveredHintType ? (
        <div
          className="absolute left-1/2 top-[calc(104px+12px)] z-20 rounded-[18px] border-2 px-4 py-3 text-left text-[15px] leading-5"
          style={{
            width: "min(100%, 330px)",
            transform: "translateX(-50%)",
            background: "#ffffff",
            borderColor: "#000000",
            color: "#000000",
            pointerEvents: "none",
            overflowWrap: "break-word",
            whiteSpace: "normal",
          }}
        >
          <span
            style={{
              display: "block",
              textAlign: "left",
              textAlignLast: "left",
              whiteSpace: "normal",
              overflowWrap: "break-word",
              wordBreak: "normal",
            }}
          >
            {renderHintSegments(hoveredHintSegments)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ClueEditor({
  clue,
  index,
  color,
  isActive,
  registerEditor,
  onActivate,
  onChange,
  onHighlightClick,
  onPaste,
}) {
  const localRef = useRef(null);

  useEffect(() => {
    if (localRef.current && localRef.current.innerHTML !== clue.html) {
      localRef.current.innerHTML = clue.html;
    }
  }, [clue.html]);

  return (
    <div
      ref={(el) => {
        localRef.current = el;
        registerEditor(index, el);
      }}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={`Clue ${index + 1}`}
      onFocus={() => onActivate(index)}
      onMouseUp={() => onActivate(index)}
      onKeyUp={() => onActivate(index)}
      onClick={(event) => onHighlightClick(event, index)}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onInput={(event) => onChange(index, event.currentTarget.innerHTML)}
      onPaste={(event) => onPaste(event, index)}
      className="w-full rounded-[18px] px-4 py-4 outline-none"
      style={{
        background: color,
        fontWeight: 400,
        minHeight: "110px",
        whiteSpace: "pre-wrap",
        textTransform: "uppercase",
        boxShadow: isActive ? "0 0 0 6px rgba(59,130,246,0.18)" : "none",
      }}
    />
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function snapToDevicePixel(value) {
  if (typeof window === "undefined") return value;
  const pixelRatio = window.devicePixelRatio || 1;
  return Math.round(value * pixelRatio) / pixelRatio;
}

function snapTopLeft(x, y) {
  return {
    x: Math.round(x / SNAP) * SNAP,
    y: Math.round(y / SNAP) * SNAP,
  };
}

function snapBottomLeft(bottomLeftX, bottomLeftY) {
  const snapped = snapTopLeft(bottomLeftX, bottomLeftY - CELL_SIZE);
  return {
    x: snapped.x,
    y: snapped.y,
  };
}

function getSquareBoundaryShape(rect) {
  return {
    centerX: rect.x + CELL_SIZE / 2,
    centerY: rect.y + CELL_SIZE / 2,
    halfWidth: BOUNDARY_SIZE / 2,
    halfHeight: BOUNDARY_SIZE / 2,
    radius: TILE_RADIUS,
    rect: {
      x: rect.x,
      y: rect.y,
      width: BOUNDARY_SIZE,
      height: BOUNDARY_SIZE,
    },
  };
}

function signedDistanceToRoundedRect(px, py, halfWidth, halfHeight, radius) {
  const qx = Math.abs(px) - halfWidth + radius;
  const qy = Math.abs(py) - halfHeight + radius;
  const outsideX = Math.max(qx, 0);
  const outsideY = Math.max(qy, 0);
  const outsideDistance = Math.hypot(outsideX, outsideY);
  const insideDistance = Math.min(Math.max(qx, qy), 0);
  return outsideDistance + insideDistance - radius;
}

function rectsOverlap(a, b) {
  const sa = getSquareBoundaryShape(a);
  const sb = getSquareBoundaryShape(b);

  const dx = sb.centerX - sa.centerX;
  const dy = sb.centerY - sa.centerY;

  return (
    signedDistanceToRoundedRect(
      dx,
      dy,
      sa.halfWidth + sb.halfWidth,
      sa.halfHeight + sb.halfHeight,
      sa.radius + sb.radius
    ) < 0
  );
}

function getTypeColor(type, isCorner) {
  if (isCorner || ["topCorner", "bottomLeftCorner", "bottomRightCorner"].includes(type)) return "#ffffff";
  if (type === "left") return "#e9dcff";
  if (type === "right") return "#d9f4d8";
  if (type === "base") return "#d9ecff";
  return "#ffffff";
}

function BoardGrid({ width = BOARD_WIDTH, height = BOARD_HEIGHT }) {
  const cols = Math.floor((width - BOARD_OFFSET_X * 2) / SNAP);
  const rows = Math.floor((height - BOARD_OFFSET_Y * 2) / SNAP);

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 rounded-[28px]"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ pointerEvents: "none" }}
    >
      {Array.from({ length: cols + 1 }, (_, i) => {
        const x = BOARD_OFFSET_X + i * SNAP;
        return (
          <line
            key={`vx-${x}`}
            x1={x}
            y1={0}
            x2={x}
            y2={height}
            stroke="rgba(0,0,0,0.08)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            shapeRendering="geometricPrecision"
          />
        );
      })}
      {Array.from({ length: rows + 1 }, (_, i) => {
        const y = BOARD_OFFSET_Y + i * SNAP;
        return (
          <line
            key={`hz-${y}`}
            x1={0}
            y1={y}
            x2={width}
            y2={y}
            stroke="rgba(0,0,0,0.08)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            shapeRendering="geometricPrecision"
          />
        );
      })}
    </svg>
  );
}

function TileOutline({ color = "#111", opacity = 1 }) {
  return (
    <svg
      aria-hidden="true"
      className="absolute overflow-visible"
      width={CELL_SIZE + BORDER_WIDTH}
      height={CELL_SIZE + BORDER_WIDTH}
      viewBox={`0 0 ${CELL_SIZE + BORDER_WIDTH} ${CELL_SIZE + BORDER_WIDTH}`}
      style={{ left: -BORDER_WIDTH / 2, top: -BORDER_WIDTH / 2, pointerEvents: "none", opacity }}
    >
      <rect
        x={BORDER_WIDTH / 2}
        y={BORDER_WIDTH / 2}
        width={CELL_SIZE}
        height={CELL_SIZE}
        rx={TILE_RADIUS}
        ry={TILE_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={BORDER_WIDTH}
        vectorEffect="non-scaling-stroke"
        shapeRendering="geometricPrecision"
      />
    </svg>
  );
}

function MiniTrianglePreview({ squares, ariaLabel, theme, highlightedSide }) {
  const bounds = getTriangleGraphicBounds(squares);
  const padding = 8;
  const viewBoxLeft = bounds.left - padding;
  const viewBoxTop = bounds.top - padding;
  const viewBoxWidth = bounds.width + CELL_SIZE + padding * 2;
  const viewBoxHeight = bounds.height + CELL_SIZE + padding * 2;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`${viewBoxLeft} ${viewBoxTop} ${viewBoxWidth} ${viewBoxHeight}`}
      className="h-[172px] w-full max-w-[220px] overflow-visible"
    >
      {squares.map((square) => {
        const isCorner = ["topCorner", "bottomLeftCorner", "bottomRightCorner"].includes(square.type);
        const isHighlighted = square.type === highlightedSide;
        const fill = isCorner
          ? theme.playerTileBg
          : isHighlighted
            ? theme.playerTileDark
            : ["left", "right", "base"].includes(square.type)
              ? theme.playerTileLight
              : theme.playerTileBg;
        return (
          <g key={square.id} transform={`translate(${square.x} ${square.y})`}>
            <rect
              x={0}
              y={0}
              width={CELL_SIZE}
              height={CELL_SIZE}
              rx={TILE_RADIUS}
              ry={TILE_RADIUS}
              fill={fill}
              stroke={theme.tileOutline}
              strokeWidth={2.25}
              vectorEffect="non-scaling-stroke"
              shapeRendering="geometricPrecision"
            />
          </g>
        );
      })}
    </svg>
  );
}

function InteractiveMiniTriangle({ squares, theme }) {
  const [selectedId, setSelectedId] = useState(() => getPreferredSelectedSquareId(squares));
  const [activeSide, setActiveSide] = useState("base");
  const [miniLetters, setMiniLetters] = useState({});
  const miniBoardRef = useRef(null);
  const boardData = useMemo(() => inferBoardData(squares), [squares]);
  const bounds = getTriangleGraphicBounds(squares);
  const padding = 30;
  const viewBoxLeft = bounds.left - padding;
  const viewBoxTop = bounds.top - padding;
  const viewBoxWidth = bounds.width + padding * 2;
  const viewBoxHeight = bounds.height + padding * 2;
  const visibleSquares = [...squares].sort((a, b) => {
    if (a.id === selectedId) return 1;
    if (b.id === selectedId) return -1;
    return 0;
  });

  const focusMiniBoard = () => {
    window.requestAnimationFrame(() => {
      miniBoardRef.current?.focus();
    });
  };

  const selectSquare = (id, { focusBoard = false } = {}) => {
    setSelectedId(id);
    const role = boardData.squareRoleById[id] || null;
    if (role?.kind === "side") setActiveSide(role.side);
    if (focusBoard) focusMiniBoard();
  };

  const moveToSideStart = (side) => {
    const endpoints = getSideReadingEndpoints(side, boardData.sideRules[side]?.isVertical);
    const startCornerId = boardData.cornerIdByRole[endpoints.startCorner];
    setActiveSide(side);
    setSelectedId(startCornerId || boardData.sideRules[side]?.ordered[0]?.id || selectedId);
    focusMiniBoard();
  };

  const handleKeyDown = (event) => {
    const directionByKey = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    const direction = directionByKey[event.key];

    if (direction) {
      const nextId = getDirectionalNextSquare(boardData, selectedId, direction);
      if (nextId) selectSquare(nextId);
      event.preventDefault();
      return;
    }

    if (/^[a-z]$/i.test(event.key)) {
      setMiniLetters((prev) => ({ ...prev, [selectedId]: event.key.toUpperCase() }));
      const nextId = boardData.insertionNextBySide[activeSide]?.[selectedId];
      if (nextId) selectSquare(nextId);
      event.preventDefault();
      return;
    }

    if (event.key === "Backspace") {
      setMiniLetters((prev) => ({ ...prev, [selectedId]: "" }));
      const nextId = boardData.deletionNextBySide[activeSide]?.[selectedId];
      if (nextId) selectSquare(nextId);
      event.preventDefault();
    }
  };

  return (
    <div className="mx-auto grid w-fit max-w-full items-center gap-5 md:grid-cols-[auto_150px]">
      <div className="flex min-w-0 justify-center">
        <svg
          ref={miniBoardRef}
          role="application"
          aria-label="Interactive 4 4 5 triangle movement example"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          viewBox={`${viewBoxLeft} ${viewBoxTop} ${viewBoxWidth} ${viewBoxHeight}`}
          className="h-[186px] w-auto max-w-full overflow-visible outline-none"
        >
          {visibleSquares.map((square) => {
            const isCorner = ["topCorner", "bottomLeftCorner", "bottomRightCorner"].includes(square.type);
            const isActive = square.id === selectedId;
            const fill = isCorner
              ? theme.playerTileBg
              : square.type === activeSide
                ? theme.playerTileDark
                : theme.playerTileLight;

            return (
              <g
                key={square.id}
                transform={`translate(${square.x} ${square.y})`}
                onClick={() => selectSquare(square.id, { focusBoard: true })}
                style={{ cursor: "pointer" }}
              >
                {isActive && (
                  <>
                    <rect
                      x={-10}
                      y={-10}
                      width={CELL_SIZE + 20}
                      height={CELL_SIZE + 20}
                      rx={TILE_RADIUS + 10}
                      ry={TILE_RADIUS + 10}
                      fill="none"
                      stroke="rgba(110,193,162,0.35)"
                      strokeWidth={12}
                    />
                    <rect
                      x={-4}
                      y={-4}
                      width={CELL_SIZE + 8}
                      height={CELL_SIZE + 8}
                      rx={TILE_RADIUS + 4}
                      ry={TILE_RADIUS + 4}
                      fill="none"
                      stroke={theme.tileOutline}
                      strokeWidth={4}
                    />
                  </>
                )}
                <rect
                  x={0}
                  y={0}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  rx={TILE_RADIUS}
                  ry={TILE_RADIUS}
                  fill={fill}
                  stroke={theme.tileOutline}
                strokeWidth={BORDER_WIDTH}
                shapeRendering="geometricPrecision"
              />
              <text
                x={CELL_SIZE / 2}
                y={CELL_SIZE / 2}
                dominantBaseline="central"
                textAnchor="middle"
                fill={theme.tileText}
                fontFamily={PLAYER_UI_FONT}
                fontSize={50}
                fontWeight={600}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {miniLetters[square.id] || ""}
              </text>
            </g>
          );
        })}
        </svg>
      </div>
      <div className="grid gap-0">
        {SIDE_NAMES.map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => moveToSideStart(side)}
            className="h-[62px] rounded-[18px] px-3 text-[15px] font-medium"
            style={{
              background: activeSide === side ? theme.clueActiveBg : theme.clueInactiveBg,
              color: theme.text,
            }}
          >
            {SIDE_DISPLAY_LABELS[side]}
          </button>
        ))}
      </div>
    </div>
  );
}

function isSideVertical(side, corners) {
  if (side === "base") return false;
  const top = corners.top;
  const bottomCorner = side === "left" ? corners.bottomLeft : corners.bottomRight;
  if (!top || !bottomCorner) return false;
  return Math.abs(top.x - bottomCorner.x) <= SNAP / 2;
}

function sortSideSquaresByGeometry(sideSquares, type, isVertical) {
  const arr = [...sideSquares];
  if (!arr.length) return arr;

  if (type === "base") return arr.sort((a, b) => a.x - b.x || a.y - b.y);
  if (type === "left") {
    if (isVertical) return arr.sort((a, b) => b.y - a.y || a.x - b.x);
    return arr.sort((a, b) => a.x - b.x || b.y - a.y || a.y - b.y);
  }
  if (isVertical) return arr.sort((a, b) => a.y - b.y || a.x - b.x);
  return arr.sort((a, b) => a.x - b.x || a.y - b.y);
}

function getSideReadingOrder(geometryOrdered, type, isVertical) {
  if (type === "left" && isVertical) return [...geometryOrdered].reverse();
  return [...geometryOrdered];
}

function getSideNavigationRules(type, isVertical) {
  if (type === "base") {
    return {
      orientation: "horizontal",
      readingOrder: "leftToRight",
      forwardKeys: ["right"],
      backwardKeys: ["left"],
    };
  }

  if (type === "left") {
    if (isVertical) {
      return {
        orientation: "vertical",
        readingOrder: "topToBottom",
        forwardKeys: ["up"],
        backwardKeys: ["down"],
      };
    }
    return {
      orientation: "diagonal",
      readingOrder: "leftToRight",
      forwardKeys: ["up", "right"],
      backwardKeys: ["down", "left"],
    };
  }

  if (isVertical) {
    return {
      orientation: "vertical",
      readingOrder: "topToBottom",
      forwardKeys: ["down"],
      backwardKeys: ["up"],
    };
  }

  return {
    orientation: "diagonal",
    readingOrder: "leftToRight",
    forwardKeys: ["down", "right"],
    backwardKeys: ["up", "left"],
  };
}

function getSideReadingEndpoints(side, isVertical) {
  if (side === "base") return { startCorner: "bottomLeft", endCorner: "bottomRight" };
  if (side === "left" && isVertical) return { startCorner: "top", endCorner: "bottomLeft" };
  return SIDE_ENDPOINTS[side];
}

function addDirectionalLink(map, fromId, toId, keys) {
  if (!fromId || !toId || !keys?.length) return;
  if (!map[fromId]) map[fromId] = {};
  keys.forEach((key) => {
    map[fromId][key] = toId;
  });
}

function inferBoardData(squares) {
  const corners = {
    top: squares.find((sq) => sq.type === "topCorner") || null,
    bottomLeft: squares.find((sq) => sq.type === "bottomLeftCorner") || null,
    bottomRight: squares.find((sq) => sq.type === "bottomRightCorner") || null,
  };

  const sideSquares = {
    left: squares.filter((sq) => sq.type === "left"),
    right: squares.filter((sq) => sq.type === "right"),
    base: squares.filter((sq) => sq.type === "base"),
  };

  const verticalSides = {
    left: isSideVertical("left", corners),
    right: isSideVertical("right", corners),
    base: false,
  };

  const sideRules = Object.fromEntries(
    SIDE_NAMES.map((side) => {
      const isVertical = verticalSides[side];
      const geometryOrdered = sortSideSquaresByGeometry(sideSquares[side], side, isVertical);
      const readingOrdered = getSideReadingOrder(geometryOrdered, side, isVertical);
      return [
        side,
        {
          isVertical,
          geometryOrdered,
          ordered: readingOrdered,
          ...getSideNavigationRules(side, isVertical),
        },
      ];
    })
  );

  const cornerIds = new Set(Object.values(corners).filter(Boolean).map((sq) => sq.id));
  const cornerRoleById = Object.fromEntries(
    Object.entries(corners)
      .filter(([, sq]) => Boolean(sq))
      .map(([role, sq]) => [sq.id, role])
  );
  const cornerIdByRole = Object.fromEntries(Object.entries(corners).map(([role, sq]) => [role, sq?.id || null]));

  const squareRoleById = {};
  SIDE_NAMES.forEach((side) => {
    sideRules[side].ordered.forEach((sq) => {
      squareRoleById[sq.id] = { kind: "side", side };
    });
  });
  Object.entries(cornerRoleById).forEach(([id, corner]) => {
    squareRoleById[id] = { kind: "corner", corner };
  });

  const squareLabelById = Object.fromEntries(
    Object.entries(squareRoleById).map(([id, role]) => [
      id,
      role.kind === "side" ? SIDE_DISPLAY_LABELS[role.side] : SIDE_DISPLAY_LABELS[role.corner],
    ])
  );

  const navMap = {};

  SIDE_NAMES.forEach((side) => {
    const geometryOrdered = sideRules[side].geometryOrdered;
    const { forwardKeys, backwardKeys } = sideRules[side];

    for (let i = 0; i < geometryOrdered.length - 1; i += 1) {
      addDirectionalLink(navMap, geometryOrdered[i].id, geometryOrdered[i + 1].id, forwardKeys);
      addDirectionalLink(navMap, geometryOrdered[i + 1].id, geometryOrdered[i].id, backwardKeys);
    }

    const startCornerId = cornerIdByRole[SIDE_ENDPOINTS[side].startCorner];
    const endCornerId = cornerIdByRole[SIDE_ENDPOINTS[side].endCorner];
    const firstId = geometryOrdered[0]?.id || null;
    const lastId = geometryOrdered[geometryOrdered.length - 1]?.id || null;

    if (startCornerId && firstId) {
      addDirectionalLink(navMap, firstId, startCornerId, backwardKeys);
    }

    if (endCornerId && lastId) {
      addDirectionalLink(navMap, lastId, endCornerId, forwardKeys);
    }
  });

  const bottomLeftCornerId = cornerIdByRole.bottomLeft;
  const bottomRightCornerId = cornerIdByRole.bottomRight;
  const topCornerId = cornerIdByRole.top;
  const firstBaseId = sideRules.base.geometryOrdered[0]?.id || null;
  const lastBaseId = sideRules.base.geometryOrdered[sideRules.base.geometryOrdered.length - 1]?.id || null;
  const firstLeftGeometryId = sideRules.left.geometryOrdered[0]?.id || null;
  const lastLeftGeometryId = sideRules.left.geometryOrdered[sideRules.left.geometryOrdered.length - 1]?.id || null;
  const firstRightGeometryId = sideRules.right.geometryOrdered[0]?.id || null;
  const lastRightGeometryId = sideRules.right.geometryOrdered[sideRules.right.geometryOrdered.length - 1]?.id || null;

  if (bottomLeftCornerId && firstBaseId) addDirectionalLink(navMap, bottomLeftCornerId, firstBaseId, ["right"]);
  if (bottomRightCornerId && lastBaseId) addDirectionalLink(navMap, bottomRightCornerId, lastBaseId, ["left"]);
  if (bottomLeftCornerId && firstLeftGeometryId) addDirectionalLink(navMap, bottomLeftCornerId, firstLeftGeometryId, ["up"]);
  if (bottomRightCornerId && lastRightGeometryId) addDirectionalLink(navMap, bottomRightCornerId, lastRightGeometryId, ["up"]);

  if (topCornerId && lastLeftGeometryId) {
    addDirectionalLink(navMap, topCornerId, lastLeftGeometryId, [sideRules.left.isVertical ? "down" : "left"]);
  }
  if (topCornerId && firstRightGeometryId) {
    addDirectionalLink(navMap, topCornerId, firstRightGeometryId, [sideRules.right.isVertical ? "down" : "right"]);
  }

  const typingOrder = [
    cornerIdByRole.bottomLeft,
    ...sideRules.left.ordered.map((sq) => sq.id),
    cornerIdByRole.top,
    ...sideRules.right.ordered.map((sq) => sq.id),
    cornerIdByRole.bottomRight,
    ...sideRules.base.ordered.map((sq) => sq.id),
  ].filter(Boolean);

  const insertionNextBySide = Object.fromEntries(
    SIDE_NAMES.map((side) => {
      const orderedIds = sideRules[side].ordered.map((sq) => sq.id);
      const readingEndpoints = getSideReadingEndpoints(side, sideRules[side].isVertical);
      const startCornerId = cornerIdByRole[readingEndpoints.startCorner];
      const endCornerId = cornerIdByRole[readingEndpoints.endCorner];
      const map = {};

      if (startCornerId && orderedIds[0]) map[startCornerId] = orderedIds[0];
      orderedIds.forEach((id, index) => {
        const nextId = orderedIds[index + 1] || endCornerId || null;
        if (nextId) map[id] = nextId;
      });

      return [side, map];
    })
  );

  const deletionNextBySide = Object.fromEntries(
    SIDE_NAMES.map((side) => {
      const orderedIds = sideRules[side].ordered.map((sq) => sq.id);
      const readingEndpoints = getSideReadingEndpoints(side, sideRules[side].isVertical);
      const startCornerId = cornerIdByRole[readingEndpoints.startCorner];
      const endCornerId = cornerIdByRole[readingEndpoints.endCorner];
      const map = {};

      if (endCornerId && orderedIds[orderedIds.length - 1]) {
        map[endCornerId] = orderedIds[orderedIds.length - 1];
      }
      orderedIds.forEach((id, index) => {
        const prevId = orderedIds[index - 1] || startCornerId || null;
        if (prevId) map[id] = prevId;
      });

      return [side, map];
    })
  );

  return {
    sides: Object.fromEntries(SIDE_NAMES.map((side) => [side, sideRules[side].ordered])),
    sideRules,
    verticalSides,
    cornerIds,
    cornerRoleById,
    cornerIdByRole,
    squareRoleById,
    squareLabelById,
    insertionNextBySide,
    deletionNextBySide,
    navMap,
    typingOrder,
  };
}

function getDirectionalNextSquare(boardData, currentId, direction) {
  return boardData.navMap?.[currentId]?.[direction] || null;
}

function isCornerType(type) {
  return ["topCorner", "bottomLeftCorner", "bottomRightCorner"].includes(type);
}

function getPreferredSelectedSquareId(squares) {
  return squares.find((sq) => sq.type === "bottomLeftCorner")?.id || squares[0]?.id || null;
}

function getTriangleGraphicBounds(squares) {
  if (!squares.length) {
    return {
      left: 0,
      top: 0,
      right: CELL_SIZE,
      bottom: CELL_SIZE,
      width: CELL_SIZE,
      height: CELL_SIZE,
      centerX: CELL_SIZE / 2,
      centerY: CELL_SIZE / 2,
    };
  }

  const left = Math.min(...squares.map((sq) => sq.x));
  const top = Math.min(...squares.map((sq) => sq.y));
  const right = Math.max(...squares.map((sq) => sq.x + CELL_SIZE));
  const bottom = Math.max(...squares.map((sq) => sq.y + CELL_SIZE));

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

export default function TriangleWordGamePrototypeFixed() {
  const isLocalEditorEnabled = isLocalEditorEnvironment();
  const [initialBootState] = useState(() => buildInitialBootState());
  const [authoringAuth, setAuthoringAuth] = useState({
    checked: false,
    authenticated: false,
    authRequired: false,
  });
  const [isAuthoringAuthBusy, setIsAuthoringAuthBusy] = useState(false);
  const [squares, setSquares] = useState(() => initialBootState.puzzleState.squares);
  const triangleGraphicBounds = useMemo(() => getTriangleGraphicBounds(squares), [squares]);
  const [selectedId, setSelectedId] = useState(() => getPreferredSelectedSquareId(initialBootState.puzzleState.squares));
  const [seconds, setSeconds] = useState(0);
  const [hasStartedGame, setHasStartedGame] = useState(false);
  const [showStartModal, setShowStartModal] = useState(true);
  const [showWelcomeBackModal, setShowWelcomeBackModal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [clues, setClues] = useState(() => initialBootState.puzzleState.clues);
  const [playerLetters, setPlayerLetters] = useState(() => buildBlankPlayerLetters(initialBootState.puzzleState.squares));
  const [editingClueIndex, setEditingClueIndex] = useState(null);
  const [mode, setMode] = useState("player");
  const [puzzlePresets, setPuzzlePresets] = useState(() => readPuzzlePresets());
  const [scheduledTriangleDebuts, setScheduledTriangleDebuts] = useState(() => readBundledTriangleDebuts());
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [showSettingsPresetMenu, setShowSettingsPresetMenu] = useState(false);
  const [showDebutMenu, setShowDebutMenu] = useState(false);
  const [showRevealMenu, setShowRevealMenu] = useState(false);
  const [showRevealConfirmModal, setShowRevealConfirmModal] = useState(false);
  const [skipRevealConfirm, setSkipRevealConfirm] = useState(() => {
    return readStoredBoolean(SKIP_REVEAL_CONFIRM_STORAGE_KEY);
  });
  const [pendingRevealAction, setPendingRevealAction] = useState(null);
  const [showHintMenu, setShowHintMenu] = useState(false);
  const [openHintSection, setOpenHintSection] = useState(null);
  const [showHintConfirmModal, setShowHintConfirmModal] = useState(false);
  const [skipHintConfirm, setSkipHintConfirm] = useState(() => {
    return readStoredBoolean(SKIP_HINT_CONFIRM_STORAGE_KEY);
  });
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [pendingHintTarget, setPendingHintTarget] = useState(null);
  const [hoveredHintTooltip, setHoveredHintTooltip] = useState(null);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(() => shouldOpenHowToPlayFromUrl());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.localStorage.getItem(DARK_MODE_DEFAULT_RESET_KEY) !== "true") {
      window.localStorage.setItem(DARK_MODE_STORAGE_KEY, "false");
      window.localStorage.setItem(DARK_MODE_DEFAULT_RESET_KEY, "true");
      return false;
    }
    return window.localStorage.getItem(DARK_MODE_STORAGE_KEY) === "true";
  });
  const [showSolvedModal, setShowSolvedModal] = useState(false);
  const [finishedState, setFinishedState] = useState(null);
  const [assistLog, setAssistLog] = useState([]);
  const [finishAssistLog, setFinishAssistLog] = useState([]);
  const [activeButton, setActiveButton] = useState(null);
  const [typingFlow, setTypingFlow] = useState(false);
  const [lastSide, setLastSide] = useState("base");
  const [dragState, setDragState] = useState(null);
  const [pendingDrag, setPendingDrag] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const inputRefs = useRef({});
  const shellRef = useRef(null);
  const boardRef = useRef(null);
  const boardPaneRef = useRef(null);
  const boardShellRef = useRef(null);
  const clockGroupRef = useRef(null);
  const clearButtonRef = useRef(null);
  const playerHeaderActionsRef = useRef(null);
  const playerCluePointerRef = useRef(null);
  const playerCluePaneRef = useRef(null);
  const hintTooltipTimeoutRef = useRef(null);
  const hintHoverOriginRef = useRef(null);
  const clueRefs = useRef({});
  const trashRef = useRef(null);
  const squareRefs = useRef({});
  const loadPuzzleInputRef = useRef(null);
  const suppressBannerDropdownCloseRef = useRef(false);
  const [boardScale, setBoardScale] = useState(1);
  const [editorBoardSize, setEditorBoardSize] = useState({ width: BOARD_WIDTH, height: BOARD_HEIGHT });
  const editorGridMaxX = Math.max(
    GRID_MIN_X,
    (mode === "editor" ? editorBoardSize.width : BOARD_WIDTH) - BOARD_OFFSET_X * 2 - CELL_SIZE
  );
  const editorGridMaxY = Math.max(
    GRID_MIN_Y,
    (mode === "editor" ? editorBoardSize.height : BOARD_HEIGHT) - BOARD_OFFSET_Y * 2 - CELL_SIZE
  );
  const clueStackRef = useRef(null);
  const clueEditorRefs = useRef({});
  const [boardOffsetX, setBoardOffsetX] = useState(0);
  const [boardOffsetY, setBoardOffsetY] = useState(0);
  const [clueStackOffsetX, setClueStackOffsetX] = useState(0);
  const [playerClueMetrics, setPlayerClueMetrics] = useState({ width: 440, height: 118 });
  const [playerNarrowScale, setPlayerNarrowScale] = useState(1);
  const [playerClueStackScale, setPlayerClueStackScale] = useState(1);
  const [playerStackedBoardShellHeight, setPlayerStackedBoardShellHeight] = useState(260);
  const [isPlayerStackedLayout, setIsPlayerStackedLayout] = useState(false);
  const playerStackedLayoutRef = useRef(false);
  const [hidePlayerModeToggle, setHidePlayerModeToggle] = useState(false);
  const [playerHorizontalTracks, setPlayerHorizontalTracks] = useState({
    boardColumn: 920,
    clueColumn: 520,
    gap: PLAYER_BOARD_CLUE_GAP,
  });
  const [playerTimerCenterX, setPlayerTimerCenterX] = useState(null);
  const [playerHeaderActionsCenterX, setPlayerHeaderActionsCenterX] = useState(null);
  const [playerBannerScale, setPlayerBannerScale] = useState(PLAYER_BANNER_TARGET_BROWSER_ZOOM);
  const [activeClueIndex, setActiveClueIndex] = useState(0);
  const [activeHintEditor, setActiveHintEditor] = useState(null);
  const [currentPuzzleName, setCurrentPuzzleName] = useState(() => initialBootState.puzzleName);
  const [currentPuzzleSource, setCurrentPuzzleSource] = useState(() => initialBootState.puzzleSource);
  const [puzzleActionStatus, setPuzzleActionStatus] = useState("");
  const [isLoadingPuzzle, setIsLoadingPuzzle] = useState(false);
  const [isSettingPreset, setIsSettingPreset] = useState(false);
  const [selectedDebutId, setSelectedDebutId] = useState(null);
  const [debutDateInput, setDebutDateInput] = useState(() => buildDefaultTriangleDebutInputs().date);
  const [debutTimeInput, setDebutTimeInput] = useState(() => buildDefaultTriangleDebutInputs().time);
  const [selectedDebutFileName, setSelectedDebutFileName] = useState("");
  const availablePresetSlots = PUZZLE_PRESET_SLOTS.filter((slot) => puzzlePresets[slot.id]);
  const isAuthoringEnabled = isLocalEditorEnabled && authoringAuth.authenticated;
  const isEditorContentLocked = false;
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const sessionSnapshotRef = useRef(null);
  const skipSessionRestoreRef = useRef(false);
  const wasPausedBeforeHowToPlayRef = useRef(false);

  const playerClues = useMemo(() => clues.map((clue) => clue.plainText), [clues]);
  const sharedPlayerClueFontSize = useMemo(
    () =>
      Math.min(
        ...playerClues.map((clue) => getClueFontSize(clue, playerClueMetrics.width, playerClueMetrics.height))
      ),
    [playerClueMetrics.height, playerClueMetrics.width, playerClues]
  );
  const isSolved = useMemo(
    () =>
      mode === "player" &&
      squares.length > 0 &&
      squares.every((sq) => (playerLetters[sq.id] || "") === (sq.letter || "")),
    [mode, playerLetters, squares]
  );
  const finishHadAssist = finishAssistLog.length > 0;
  const earnedPerfectSolve = !finishHadAssist && seconds < 120;
  const solvedModalStars = finishHadAssist ? "" : earnedPerfectSolve ? "⭐ ⭐ ⭐" : "⭐";
  const isPlayerFinished = mode === "player" && Boolean(finishedState);
  const solvedTimeline = useMemo(
    () => getAssistTimelineSymbols(finishAssistLog, solvedModalStars),
    [finishAssistLog, solvedModalStars]
  );
  const activeTriangleDebut = useMemo(
    () => getActiveTriangleDebut(scheduledTriangleDebuts),
    [scheduledTriangleDebuts]
  );
  const livePuzzleSource = useMemo(
    () => buildLivePuzzleSourceDescriptor(activeTriangleDebut, puzzlePresets),
    [activeTriangleDebut, puzzlePresets]
  );
  const defaultSourceLabel = activeTriangleDebut
    ? `Default live source: debut "${getDebutDisplayName(activeTriangleDebut)}"`
    : `Default live source: ${PUZZLE_PRESET_SLOTS[0].label}`;
  const selectedTriangleDebut = useMemo(
    () => scheduledTriangleDebuts.find((entry) => entry.id === selectedDebutId) || null,
    [scheduledTriangleDebuts, selectedDebutId]
  );
  const playerLayoutKey =
    mode === "player"
      ? [
          sessionHydrated ? "hydrated" : "pending",
          currentPuzzleSource?.sourceKey || currentPuzzleName,
          squares.length,
          clues.length,
          showHowToPlay ? "how-to-play" : "game",
        ].join(":")
      : "editor";
  const [readyPlayerLayoutKey, setReadyPlayerLayoutKey] = useState("");
  const [settledPlayerLayoutKey, setSettledPlayerLayoutKey] = useState("");
  const isPlayerLayoutReady = mode !== "player" || readyPlayerLayoutKey === playerLayoutKey;
  const arePlayerTransitionsReady = mode !== "player" || settledPlayerLayoutKey === playerLayoutKey;
  const shouldShowPlayerClues = mode === "player";
  const revealedHintTypesBySection = useMemo(() => {
    const revealed = {};

    assistLog.forEach((entry) => {
      if (entry.type !== "hint" || !entry.scope) return;
      const [sectionHeading, itemLabel] = entry.scope.split("-");
      if (!sectionHeading || !itemLabel) return;
      const normalizedType = itemLabel.trim().toLowerCase();
      if (!revealed[sectionHeading]) revealed[sectionHeading] = new Set();
      revealed[sectionHeading].add(normalizedType);
    });

    return revealed;
  }, [assistLog]);
  const areAllHintsRevealed = useMemo(
    () =>
      HINT_SECTIONS.every((section) =>
        section.items.every((item) => revealedHintTypesBySection[section.heading]?.has(item.toLowerCase()))
      ),
    [revealedHintTypesBySection]
  );
  const shouldBlurPlayerContent =
    mode === "player" &&
    !showHowToPlay &&
    !finishedState &&
    ((hasStartedGame && isPaused) || showStartModal);
  const isPlayerInputLocked = mode === "player" && shouldBlurPlayerContent;
  const usePlayerAppearanceTheme = mode === "player" && isDarkMode;
  const theme = useMemo(
    () =>
      usePlayerAppearanceTheme
        ? {
            appBg: "#11161c",
            shellBg: "#18212b",
            shellBorder: "#334155",
            topBarBg: "#1d2733",
            topBarBorder: "#334155",
            text: "#f8fafc",
            mutedText: "rgba(248,250,252,0.72)",
            disabledText: "rgba(248,250,252,0.35)",
            menuBg: "#223040",
            menuBorder: "#3b4b5d",
            menuHoverBg: "#314255",
            playerBoardBg: "transparent",
            boardBg: "#121a23",
            boardBorder: "#334155",
            clueActiveBg: "#2f7d67",
            clueInactiveBg: "#2e4d58",
            playerTileBg: "#eff4f8",
            playerTileLight: "#2e4d58",
            playerTileDark: "#2f7d67",
            tileText: "#0f172a",
            tileOutline: "#8fa3b3",
            controlBorder: "#475569",
            controlActiveBg: "#314255",
            controlGroupBg: "#1a2430",
            editorMuted: "rgba(248,250,252,0.58)",
            modalBg: "#1d2733",
            modalBorder: "#334155",
            modalText: "#f8fafc",
            modalMutedText: "rgba(248,250,252,0.72)",
            inputBg: "#223040",
            inputBorder: "#475569",
            solvedButtonBg: "#f8fafc",
            solvedButtonText: "#1f6c59",
          }
        : {
            appBg: "#f7f7f7",
            shellBg: "#ffffff",
            shellBorder: "#bdbdbd",
            topBarBg: "#ffffff",
            topBarBorder: "#bdbdbd",
            text: "#000000",
            mutedText: "rgba(0,0,0,0.65)",
            disabledText: "rgba(0,0,0,0.3)",
            menuBg: "#ffffff",
            menuBorder: "#d4d4d4",
            menuHoverBg: "#f4f4f4",
            playerBoardBg: "transparent",
            boardBg: "#ffffff",
            boardBorder: "#cfcfcf",
            clueActiveBg: "#6ec1a2",
            clueInactiveBg: "#BFE1D6",
            playerTileBg: "#ffffff",
            playerTileLight: "#BFE1D6",
            playerTileDark: "#6ec1a2",
            tileText: "#000000",
            tileOutline: "#111111",
            controlBorder: "#d4d4d4",
            controlActiveBg: "#e5e5e5",
            controlGroupBg: "#ffffff",
            editorMuted: "rgba(0,0,0,0.55)",
            modalBg: "#ffffff",
            modalBorder: "#d4d4d4",
            modalText: "#000000",
            modalMutedText: "rgba(0,0,0,0.7)",
            inputBg: "#ffffff",
            inputBorder: "#d8d8d8",
            solvedButtonBg: "#ffffff",
            solvedButtonText: "#4f8f7a",
          },
    [usePlayerAppearanceTheme]
  );
  const unlockedHintHoverBg = "#AAD7C9";
  const startModalBg = usePlayerAppearanceTheme ? theme.modalBg : "#BFE1D6";
  const startModalBorder = usePlayerAppearanceTheme ? theme.modalBorder : "transparent";
  const startModalTitleColor = theme.modalText;
  const startModalBodyColor = usePlayerAppearanceTheme ? theme.modalMutedText : "rgba(0, 0, 0, 0.78)";
  const startModalButtonBg = usePlayerAppearanceTheme ? theme.clueActiveBg : "#ffffff";
  const startModalButtonText = usePlayerAppearanceTheme ? "#ffffff" : "#000000";
  const solvedModalBg = usePlayerAppearanceTheme ? theme.clueActiveBg : "#6ec1a2";
  const solvedModalBorder = usePlayerAppearanceTheme ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.18)";
  const solvedModalText = usePlayerAppearanceTheme ? "#ffffff" : "#000000";
  const solvedModalLabelText = usePlayerAppearanceTheme ? "rgba(248,250,252,0.78)" : "#ffffff";
  const solvedModalBodyText = usePlayerAppearanceTheme ? "rgba(248,250,252,0.78)" : "#000000";
  const howToPlayTheme = useMemo(
    () =>
      usePlayerAppearanceTheme
        ? {
            pageBg: "#121a23",
            cardBg: "#1d2733",
            nestedBg: "#223040",
            accentBg: "#2f7d67",
            softAccentBg: "#2e4d58",
            text: "#f8fafc",
            bodyText: "rgba(248,250,252,0.76)",
            strongText: "rgba(248,250,252,0.9)",
            border: "#334155",
            accentBorder: "#2f7d67",
            shadow: "0 16px 34px rgba(0,0,0,0.22)",
          }
        : {
            pageBg: "#BFE1D6",
            cardBg: "#ffffff",
            nestedBg: "#ffffff",
            accentBg: "#6ec1a2",
            softAccentBg: "#BFE1D6",
            text: "#0f1f1a",
            bodyText: "rgba(0,0,0,0.72)",
            strongText: "rgba(0,0,0,0.82)",
            border: "transparent",
            accentBorder: "#BFE1D6",
            shadow: "0 16px 34px rgba(15,31,26,0.08)",
          },
    [usePlayerAppearanceTheme]
  );
  const playerClueHighlightStyles = useMemo(
    () => `
      .player-clue-rich .player-highlight-wordplay {
        background: #ffffff !important;
        color: #000000 !important;
        border-radius: 0.28em;
        padding: 0.015em 0.04em 0.015em 0.04em;
        margin: 0 0.02em;
        line-height: 1;
        display: inline;
        vertical-align: 0.01em;
        box-decoration-break: clone;
        -webkit-box-decoration-break: clone;
      }

      .player-clue-rich .player-highlight-fodder {
        background: ${theme.clueActiveBg} !important;
        color: ${usePlayerAppearanceTheme ? "#ffffff" : "#000000"} !important;
        border-radius: 0.28em;
        padding: 0.015em 0.04em 0.015em 0.04em;
        margin: 0 0.02em;
        line-height: 1;
        display: inline;
        vertical-align: 0.01em;
        box-decoration-break: clone;
        -webkit-box-decoration-break: clone;
      }

      .player-clue-rich-active .player-highlight-fodder {
        background: ${theme.clueInactiveBg} !important;
      }

      .player-clue-rich {
        line-height: 1.38;
        user-select: text;
        -webkit-user-select: text;
      }

      .player-clue-rich * {
        user-select: text;
        -webkit-user-select: text;
      }

      .player-clue-rich::selection,
      .player-clue-rich *::selection {
        background: rgba(37, 99, 235, 0.72) !important;
        color: #ffffff !important;
        text-decoration-color: #ffffff !important;
      }

      .player-clue-rich .player-highlight-definition {
        background: transparent !important;
        color: inherit !important;
        text-decoration: underline;
        text-decoration-thickness: 0.08em;
        text-underline-offset: 0.14em;
      }
    `,
    [theme.clueActiveBg, theme.clueInactiveBg, usePlayerAppearanceTheme]
  );

  const restoreSnapshotState = (restoredSession, options = {}) => {
    const {
      restart = false,
      forcePause = false,
      showWelcomeBack = false,
      nextPuzzleSource = null,
    } = options;

    setSquares(restoredSession.squares);
    setClues(restoredSession.clues);
    setSelectedId(restoredSession.selectedId);
    setSelectedIds([]);
    setLastSide(restoredSession.lastSide);
    setCurrentPuzzleName(restoredSession.currentPuzzleName);
    setCurrentPuzzleSource(nextPuzzleSource);
    setSelectedDebutId(restoredSession.selectedDebutId);
    setDebutDateInput(restoredSession.debutDateInput || buildDefaultTriangleDebutInputs().date);
    setDebutTimeInput(restoredSession.debutTimeInput || buildDefaultTriangleDebutInputs().time);
    setSelectedDebutFileName(restoredSession.selectedDebutFileName);

    if (restart) {
      setPlayerLetters(buildBlankPlayerLetters(restoredSession.squares));
      setSeconds(0);
      setHasStartedGame(false);
      setShowStartModal(true);
      setShowWelcomeBackModal(false);
      setIsPaused(false);
      setMode("player");
      setShowSolvedModal(false);
      setFinishedState(null);
      setAssistLog([]);
      setFinishAssistLog([]);
      return;
    }

    setPlayerLetters(restoredSession.playerLetters);
    setSeconds(restoredSession.seconds);
    setHasStartedGame(restoredSession.hasStartedGame);
    setShowStartModal(showWelcomeBack ? false : restoredSession.showStartModal);
    setShowWelcomeBackModal(showWelcomeBack || restoredSession.showWelcomeBackModal);
    setIsPaused(
      showWelcomeBack || restoredSession.showWelcomeBackModal
        ? true
        : forcePause && restoredSession.hasStartedGame && !restoredSession.finishedState
        ? true
        : restoredSession.isPaused
    );
    setMode(restoredSession.mode);
    setShowSolvedModal(restoredSession.showSolvedModal);
    setFinishedState(restoredSession.finishedState);
    setAssistLog(restoredSession.assistLog);
    setFinishAssistLog(restoredSession.finishAssistLog);
  };

  useEffect(() => {
    if (sessionHydrated) return;
    if (typeof window === "undefined") {
      setSessionHydrated(true);
      return;
    }

    try {
      const rawLiveSession = window.localStorage.getItem(LIVE_GAME_STATE_STORAGE_KEY);
      const rawSession = window.sessionStorage.getItem(GAME_SESSION_STORAGE_KEY);
      const navigationEntry = window.performance?.getEntriesByType?.("navigation")?.[0];
      const navigationType = navigationEntry?.type || "navigate";
      let restored = false;

      if (rawLiveSession) {
        const parsedLiveSession = JSON.parse(rawLiveSession);
        const restoredLiveSession = normalizeGameSessionSnapshot(parsedLiveSession, {
          allowEditorMode: false,
        });

        if (
          restoredLiveSession &&
          restoredLiveSession.puzzleSourceKind === "live" &&
          restoredLiveSession.puzzleSourceKey === livePuzzleSource.sourceKey
        ) {
          const reopened = navigationType !== "reload";
          restoreSnapshotState(restoredLiveSession, {
            nextPuzzleSource: livePuzzleSource,
            forcePause: navigationType === "reload",
            showWelcomeBack:
              !restoredLiveSession.showWelcomeBackModal &&
              reopened &&
              restoredLiveSession.hasStartedGame &&
              !restoredLiveSession.finishedState,
          });
          restored = true;
        } else {
          window.localStorage.removeItem(LIVE_GAME_STATE_STORAGE_KEY);
        }
      }

      if (!restored && rawSession) {
        const parsedSession = JSON.parse(rawSession);
        const restoredSession = normalizeGameSessionSnapshot(parsedSession, {
          allowEditorMode: isLocalEditorEnabled,
        });

        if (restoredSession) {
          if (restoredSession.puzzleSourceKind === "playtest") {
            restoreSnapshotState(restoredSession, {
              restart: true,
              nextPuzzleSource: {
                kind: "playtest",
                sourceKey: restoredSession.puzzleSourceKey || "playtest:restored",
              },
            });
            restored = true;
          } else if (restoredSession.mode === "editor" || restoredSession.puzzleSourceKind === "editor") {
            restoreSnapshotState(restoredSession, {
              nextPuzzleSource: {
                kind: "editor",
                sourceKey: restoredSession.puzzleSourceKey || `editor:${restoredSession.currentPuzzleName}`,
              },
            });
            restored = true;
          }
        }
      }

      if (!restored) {
        setCurrentPuzzleSource(livePuzzleSource);
      }
    } catch {
      // Ignore invalid session snapshots and start fresh.
    } finally {
      try {
        window.sessionStorage.setItem(LIVE_GAME_TAB_SOURCE_KEY, livePuzzleSource.sourceKey);
      } catch {
        // Ignore tab marker failures and keep the app running.
      }
      setSessionHydrated(true);
    }
  }, [isLocalEditorEnabled, livePuzzleSource, sessionHydrated]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DARK_MODE_STORAGE_KEY, String(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncFromLocation = () => {
      const shouldOpen = shouldOpenHowToPlayFromUrl();
      setShowHowToPlay(shouldOpen);

      if (shouldOpen) {
        setMode("player");
        setShowHintMenu(false);
        setShowRevealMenu(false);
        setShowSettingsMenu(false);
        setShowSettingsPresetMenu(false);
        setOpenHintSection(null);
        setActiveButton("help");
        setHoveredHintTooltip(null);
      } else {
        setActiveButton(null);
      }
    };

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  useEffect(() => {
    if (!ENABLE_PREFERENCE_MEMORY) {
      setPreferencesLoaded(true);
      return undefined;
    }

    let cancelled = false;

    const syncPreferencesFromBackend = async () => {
      try {
        const preferences = await fetchPreferences();
        if (cancelled) return;

        if (typeof preferences.skipHintConfirm === "boolean") {
          setSkipHintConfirm(preferences.skipHintConfirm);
          window.localStorage.setItem(
            SKIP_HINT_CONFIRM_STORAGE_KEY,
            String(preferences.skipHintConfirm)
          );
        }

        if (typeof preferences.skipRevealConfirm === "boolean") {
          setSkipRevealConfirm(preferences.skipRevealConfirm);
          window.localStorage.setItem(
            SKIP_REVEAL_CONFIRM_STORAGE_KEY,
            String(preferences.skipRevealConfirm)
          );
        }
      } catch {
        // Keep localStorage fallback when the backend isn't running yet.
      } finally {
        if (!cancelled) {
          setPreferencesLoaded(true);
        }
      }
    };

    syncPreferencesFromBackend();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLocalEditorEnabled) return undefined;

    let cancelled = false;

    const syncAuthState = async () => {
      try {
        const session = await fetchAuthSession();
        if (cancelled) return;
        setAuthoringAuth({
          checked: true,
          authenticated: Boolean(session?.authenticated),
          authRequired: Boolean(session?.authRequired),
        });
      } catch {
        if (cancelled) return;
        setAuthoringAuth({
          checked: true,
          authenticated: false,
          authRequired: true,
        });
      }
    };

    syncAuthState();

    return () => {
      cancelled = true;
    };
  }, [isLocalEditorEnabled]);

  useEffect(() => {
    if (!isLocalEditorEnabled) return undefined;
    if (!authoringAuth.checked) return undefined;
    if (!authoringAuth.authenticated) return undefined;

    let cancelled = false;

    const syncPuzzlePresetsFromBackend = async () => {
      try {
        const entries = await fetchPuzzlePresets();
        if (cancelled || !entries || typeof entries !== "object") return;

        const sanitized = Object.fromEntries(
          PUZZLE_PRESET_SLOTS.map((slot) => [slot.id, sanitizePuzzlePresetEntry(entries[slot.id])]).filter(
            ([, preset]) => Boolean(preset)
          )
        );

        setPuzzlePresets((prev) => ({
          ...BUILT_IN_PUZZLE_PRESETS,
          ...BUNDLED_REPO_PUZZLE_PRESETS,
          ...prev,
          ...sanitized,
        }));
        writeStoredPuzzlePresets({
          ...readStoredPuzzlePresets(),
          ...sanitized,
        });
      } catch {
        // Keep bundled/local preset data if the backend is unavailable.
      }
    };

    const syncTriangleDebutsFromBackend = async () => {
      try {
        const entries = await fetchTriangleDebuts();
        if (cancelled || !Array.isArray(entries)) return;

        const now = Date.now();
        const sanitized = sortTriangleDebuts(
          entries
            .map((entry) => sanitizeTriangleDebutEntry(entry))
            .filter((entry) => Boolean(entry) && new Date(entry.endsAt).getTime() > now)
        );
        setScheduledTriangleDebuts(sanitized);
      } catch {
        // Keep bundled schedule data if the backend is unavailable.
      }
    };

    syncPuzzlePresetsFromBackend();
    syncTriangleDebutsFromBackend();

    return () => {
      cancelled = true;
    };
  }, [authoringAuth.authenticated, authoringAuth.checked, isLocalEditorEnabled]);

  useEffect(() => {
    if (isAuthoringEnabled) return;
    setShowPresetMenu(false);
    setShowDebutMenu(false);
    setShowSettingsPresetMenu(false);
  }, [isAuthoringEnabled]);

  useEffect(() => {
    if (!ENABLE_PREFERENCE_MEMORY) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SKIP_HINT_CONFIRM_STORAGE_KEY, String(skipHintConfirm));
  }, [skipHintConfirm]);

  useEffect(() => {
    if (!ENABLE_PREFERENCE_MEMORY) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SKIP_REVEAL_CONFIRM_STORAGE_KEY, String(skipRevealConfirm));
  }, [skipRevealConfirm]);

  useEffect(() => {
    if (!ENABLE_PREFERENCE_MEMORY) return;
    if (!preferencesLoaded) return;
    savePreferences({ skipHintConfirm }).catch(() => {
      // Keep localStorage as the durability fallback if the backend is unavailable.
    });
  }, [preferencesLoaded, skipHintConfirm]);

  useEffect(() => {
    if (!ENABLE_PREFERENCE_MEMORY) return;
    if (!preferencesLoaded) return;
    savePreferences({ skipRevealConfirm }).catch(() => {
      // Keep localStorage as the durability fallback if the backend is unavailable.
    });
  }, [preferencesLoaded, skipRevealConfirm]);

  useEffect(() => {
    if (!puzzleActionStatus) return undefined;

    const timeout = window.setTimeout(() => {
      setPuzzleActionStatus("");
    }, 3200);

    return () => window.clearTimeout(timeout);
  }, [puzzleActionStatus]);

  useEffect(() => {
    if (!sessionHydrated) return;
    if (!livePuzzleSource) return;
    if (currentPuzzleSource?.kind && currentPuzzleSource.kind !== "live") return;
    if (currentPuzzleSource?.sourceKey === livePuzzleSource.sourceKey) return;

    applyLoadedPuzzle(livePuzzleSource.puzzle, livePuzzleSource.name, {
      nextMode: "player",
      nextPuzzleSource: livePuzzleSource,
    });
  }, [currentPuzzleSource, livePuzzleSource, sessionHydrated]);

  useEffect(() => {
    if (!sessionHydrated) return;
    if (typeof window === "undefined") return;

    const snapshot = {
      version: GAME_SESSION_SCHEMA_VERSION,
      puzzle: serializePuzzleState(squares, clues),
      playerLetters,
      seconds,
      hasStartedGame,
      showStartModal,
      isPaused,
      mode,
      showSolvedModal,
      finishedState,
      assistLog,
      finishAssistLog,
      selectedId,
      lastSide,
      currentPuzzleName,
      selectedDebutId,
      debutDateInput,
      debutTimeInput,
      selectedDebutFileName,
      showWelcomeBackModal,
      puzzleSourceKind: currentPuzzleSource?.kind || null,
      puzzleSourceKey: currentPuzzleSource?.sourceKey || null,
    };

    sessionSnapshotRef.current = snapshot;

    try {
      if (currentPuzzleSource?.kind === "live") {
        window.localStorage.setItem(LIVE_GAME_STATE_STORAGE_KEY, JSON.stringify(snapshot));
        window.sessionStorage.removeItem(GAME_SESSION_STORAGE_KEY);
        window.sessionStorage.setItem(LIVE_GAME_TAB_SOURCE_KEY, currentPuzzleSource.sourceKey);
      } else {
        window.sessionStorage.setItem(GAME_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
      }
    } catch {
      // Ignore storage write failures and keep the in-memory game running.
    }
  }, [
    assistLog,
    clues,
    currentPuzzleName,
    currentPuzzleSource,
    debutDateInput,
    debutTimeInput,
    finishAssistLog,
    finishedState,
    hasStartedGame,
    isPaused,
    lastSide,
    mode,
    playerLetters,
    seconds,
    selectedDebutFileName,
    selectedDebutId,
    selectedId,
    sessionHydrated,
    showSolvedModal,
    showStartModal,
    showWelcomeBackModal,
    squares,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const clearSessionForHardReload = () => {
      skipSessionRestoreRef.current = true;
      sessionSnapshotRef.current = null;
      try {
        window.sessionStorage.removeItem(GAME_SESSION_STORAGE_KEY);
        window.localStorage.removeItem(LIVE_GAME_STATE_STORAGE_KEY);
      } catch {
        // Ignore storage failures and let the browser continue reloading.
      }
    };

    const handleKeyDown = (event) => {
      const isHardReloadShortcut =
        event.shiftKey &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "r";

      if (isLocalEditorEnabled && isHardReloadShortcut) {
        clearSessionForHardReload();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLocalEditorEnabled]);

  useEffect(() => {
    if (!hasStartedGame || isPaused || mode === "editor" || finishedState) return undefined;
    const timer = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [finishedState, hasStartedGame, isPaused, mode]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const closeBannerDropdowns = () => {
      setShowHintMenu(false);
      setShowRevealMenu(false);
      setShowSettingsMenu(false);
      setShowSettingsPresetMenu(false);
      setShowDebutMenu(false);
      setOpenHintSection(null);
      setActiveButton(null);
      setHoveredHintTooltip(null);
    };

    const pauseFromFocusLoss = () => {
      if (suppressBannerDropdownCloseRef.current) return;
      closeBannerDropdowns();
      setIsPaused((prev) => {
        if (prev || !hasStartedGame || mode === "editor" || finishedState) return prev;
        return true;
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseFromFocusLoss();
      }
    };

    const handlePageHide = () => {
      if (!skipSessionRestoreRef.current && sessionSnapshotRef.current) {
        try {
          if (sessionSnapshotRef.current.puzzleSourceKind === "live") {
            window.localStorage.setItem(
              LIVE_GAME_STATE_STORAGE_KEY,
              JSON.stringify(sessionSnapshotRef.current)
            );
            if (sessionSnapshotRef.current.puzzleSourceKey) {
              window.sessionStorage.setItem(
                LIVE_GAME_TAB_SOURCE_KEY,
                sessionSnapshotRef.current.puzzleSourceKey
              );
            }
          } else {
            window.sessionStorage.setItem(
              GAME_SESSION_STORAGE_KEY,
              JSON.stringify(sessionSnapshotRef.current)
            );
          }
        } catch {
          // Ignore storage write failures during shutdown.
        }
      }
      pauseFromFocusLoss();
    };

    const handleBeforeUnload = () => {
      handlePageHide();
    };

    window.addEventListener("blur", pauseFromFocusLoss);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("freeze", pauseFromFocusLoss);

    return () => {
      window.removeEventListener("blur", pauseFromFocusLoss);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("freeze", pauseFromFocusLoss);
    };
  }, [finishedState, hasStartedGame, mode]);

  useEffect(() => {
    if (!isSolved || finishedState) return;
    setIsPaused(true);
    setFinishAssistLog(assistLog);
    setFinishedState("solved");
    setShowSolvedModal(true);
  }, [assistLog, finishedState, isSolved]);

  const stackedHintTooltipGap = useMemo(() => {
    const tooltipWidth = Math.max(playerClueMetrics.width * playerClueStackScale, 180);
    const hintTexts = clues.flatMap((clue) => Object.values(clue.hints || {})).filter((hint) => String(hint || "").trim());
    const maxTooltipHeight = hintTexts.reduce((height, hintText) => {
      const segments = getHintTooltipSegments(hintText);
      const width = getHintTooltipOuterWidth(segments, tooltipWidth);
      return Math.max(height, getHintTooltipEstimatedHeight(segments, width));
    }, 0);

    return clamp(
      maxTooltipHeight + PLAYER_STACKED_HINT_TOOLTIP_GAP * 2,
      PLAYER_STACKED_MIN_BOARD_CLUE_GAP,
      PLAYER_STACKED_MAX_HINT_SLOT
    );
  }, [clues, playerClueMetrics.width, playerClueStackScale]);
  const renderedBoardScale = mode === "player" ? boardScale * playerNarrowScale : boardScale;

  useLayoutEffect(() => {
    if (showHowToPlay) return undefined;

    const pane = boardPaneRef.current;
    const shell = boardShellRef.current;
    const playerCluePane = playerCluePaneRef.current;
    if (!pane || !shell) return undefined;

    const updateScale = () => {
      const shellWidth = shell.clientWidth || 0;
      const shellHeight = shell.clientHeight || 0;

      if (mode === "player") {
        const shellRect = shellRef.current?.getBoundingClientRect();
        const pageLeft = shellRect?.left ?? 0;
        const pageRight = shellRect?.right ?? window.innerWidth;
        const pageWidth = Math.max(pageRight - pageLeft, 1);
        const clueHeight = CLUE_BOX_HEIGHT * clues.length;
        const measuredClueHeight = clueStackRef.current?.clientHeight || clueHeight;
        const targetGraphicHeight = PLAYER_TRIANGLE_CLUE_RATIO * measuredClueHeight;
        const graphicHeight = Math.max(triangleGraphicBounds.height, 1);
        const graphicWidth = Math.max(triangleGraphicBounds.width, 1);
        const horizontalBoardScale = targetGraphicHeight / graphicHeight;
        let narrowScale = 1;
        const stackWidth = PLAYER_CLUE_STACK_MAX_WIDTH;
        let clueContentWidth = PLAYER_CLUE_STACK_MAX_WIDTH;
        if (playerCluePane) {
          const cluePaneRect = playerCluePane.getBoundingClientRect();
          const cluePaneStyles = window.getComputedStyle(playerCluePane);
          clueContentWidth = Math.max(
            cluePaneRect.width -
              parseFloat(cluePaneStyles.paddingLeft || "0") -
              parseFloat(cluePaneStyles.paddingRight || "0"),
            0
          );
        }
        const bottomLeft = squares.find((sq) => sq.type === "bottomLeftCorner");
        const bottomRight = squares.find((sq) => sq.type === "bottomRightCorner");
        const baseMidpointX = bottomLeft && bottomRight
          ? (bottomLeft.x + bottomRight.x) / 2 + CELL_SIZE / 2
          : triangleGraphicBounds.centerX;
        const baseLeftUnits = BOARD_OFFSET_X + (bottomLeft?.x ?? triangleGraphicBounds.left);
        const baseRightUnits =
          BOARD_OFFSET_X + ((bottomRight?.x ?? triangleGraphicBounds.right - CELL_SIZE) + CELL_SIZE);
        const baseWidth = Math.max((baseRightUnits - baseLeftUnits) * horizontalBoardScale, 1);
        const horizontalGraphicWidth = Math.max(graphicWidth * horizontalBoardScale, baseWidth, 1);
        const baselinePageWidth = Math.max(pageWidth, PLAYER_HORIZONTAL_BASELINE_WIDTH);
        const naturalRightLane = Math.max(PLAYER_BOARD_CLUE_GAP, baselinePageWidth * PLAYER_HORIZONTAL_RIGHT_LANE_RATIO);
        const naturalCenterLane = Math.max(
          naturalRightLane,
          Math.min(
            naturalRightLane + stackWidth * PLAYER_HORIZONTAL_CENTER_LANE_RATIO,
            baselinePageWidth - horizontalGraphicWidth - stackWidth - naturalRightLane * 2
          )
        );
        const naturalLeftLane = Math.max(
          baselinePageWidth - horizontalGraphicWidth - naturalCenterLane - stackWidth - naturalRightLane,
          naturalRightLane
        );
        const baseline = {
          pageWidth: baselinePageWidth,
          leftLane: naturalLeftLane,
          centerLane: naturalCenterLane,
          rightLane: naturalRightLane,
        };
        const rightLane = Math.max(baseline.rightLane, PLAYER_BOARD_CLUE_GAP);
        const pageWidthDelta = Math.max(baseline.pageWidth - pageWidth, 0);
        const leftShrinkCapacity = Math.max(baseline.leftLane - rightLane, 0);
        const centerShrinkCapacity = Math.max(baseline.centerLane - rightLane, 0);
        const leftSpend = Math.min(pageWidthDelta, leftShrinkCapacity);
        const centerSpend = Math.min(Math.max(pageWidthDelta - leftShrinkCapacity, 0), centerShrinkCapacity);
        const resolvedLeftLane = baseline.leftLane - leftSpend;
        const resolvedCenterLane = baseline.centerLane - centerSpend;
        const intermediateProgress = clamp(
          (PLAYER_INTERMEDIATE_START_WIDTH - pageWidth) /
            Math.max(PLAYER_INTERMEDIATE_START_WIDTH - PLAYER_STACKED_LAYOUT_WIDTH, 1),
          0,
          1
        );
        const horizontalLayoutScale =
          1 - (1 - PLAYER_INTERMEDIATE_SCALE) * intermediateProgress;
        const stackedLayout = pageWidth <= PLAYER_STACKED_LAYOUT_WIDTH;
        playerStackedLayoutRef.current = stackedLayout;
        setIsPlayerStackedLayout(stackedLayout);
        setHidePlayerModeToggle(stackedLayout || horizontalLayoutScale < 0.999);
        const horizontalRenderedBoardScale = horizontalBoardScale * horizontalLayoutScale;
        const horizontalStartOffset = PLAYER_HORIZONTAL_START_OFFSET * horizontalLayoutScale;
        const horizontalTriangleLeftUnits = BOARD_OFFSET_X + triangleGraphicBounds.left;
        const horizontalTriangleRightUnits = BOARD_OFFSET_X + triangleGraphicBounds.right;
        const visualTriangleWidth = Math.max(
          (horizontalTriangleRightUnits - horizontalTriangleLeftUnits) * horizontalRenderedBoardScale,
          1
        );
        const visualStackWidth = stackWidth * horizontalLayoutScale;
        const naturalVisibleLeftLane = resolvedLeftLane * horizontalLayoutScale + horizontalStartOffset;
        const naturalVisibleCenterLane = resolvedCenterLane * horizontalLayoutScale;
        const naturalVisibleRightLane = rightLane * horizontalLayoutScale;
        const equalLane = Math.max((pageWidth - visualTriangleWidth - visualStackWidth) / 3, 0);
        const laneEqualizationProgress = intermediateProgress > 0 ? 1 : 0;
        const resolvedVisibleLeftLane =
          naturalVisibleLeftLane + (equalLane - naturalVisibleLeftLane) * laneEqualizationProgress;
        const resolvedVisibleCenterLane =
          naturalVisibleCenterLane + (equalLane - naturalVisibleCenterLane) * laneEqualizationProgress;
        const resolvedVisibleRightLane =
          naturalVisibleRightLane + (equalLane - naturalVisibleRightLane) * laneEqualizationProgress;
        const horizontalBoardOffsetX =
          resolvedVisibleLeftLane - horizontalTriangleLeftUnits * horizontalRenderedBoardScale;
        const horizontalTriangleCenter =
          horizontalBoardOffsetX + (BOARD_OFFSET_X + baseMidpointX) * horizontalRenderedBoardScale;
        const horizontalTriangleRight =
          resolvedVisibleLeftLane + visualTriangleWidth;
        const boardClipBuffer = PLAYER_TRIANGLE_CLIP_BUFFER * horizontalLayoutScale;
        const boardColumn = Math.max(horizontalTriangleRight + boardClipBuffer, 1);
        const middleLane = Math.max(resolvedVisibleCenterLane - boardClipBuffer, 0);
        const clueColumn = Math.max(visualStackWidth + resolvedVisibleRightLane, 1);
        setPlayerHorizontalTracks({
          boardColumn,
          clueColumn,
          gap: middleLane,
        });
        setPlayerTimerCenterX(
          stackedLayout
            ? null
            : (horizontalTriangleCenter - PLAYER_TOP_BAR_HORIZONTAL_PADDING) / Math.max(playerBannerScale, 0.001)
        );
        const stackedTriangleScale =
          Math.min(PLAYER_STACKED_TRIANGLE_SCALE, horizontalRenderedBoardScale) *
          PLAYER_STACKED_TRIANGLE_SCALE_BOOST;

        if (stackedLayout) {
          const availableWidth = Math.max(Math.min(shellWidth, clueContentWidth || shellWidth) - 40, 1);
          const availableHeight = Math.max(
            (window.visualViewport?.height || window.innerHeight || shellHeight) -
              62 * playerBannerScale -
              52,
            1
          );
          const unscaledVerticalHeight =
            graphicHeight * stackedTriangleScale +
            stackedHintTooltipGap +
            measuredClueHeight * PLAYER_STACKED_CLUE_SCALE +
            PLAYER_STACKED_BOTTOM_PADDING * 2;
          narrowScale = Math.min(
            1,
            availableWidth / Math.max(stackWidth * PLAYER_STACKED_CLUE_SCALE, graphicWidth * stackedTriangleScale, 1),
            availableHeight / Math.max(unscaledVerticalHeight, 1)
          );
          const stackedClueScale = narrowScale * PLAYER_STACKED_CLUE_SCALE;
          const verticalBoardScale = stackedTriangleScale * narrowScale;
          const visualGraphicCenterX = (BOARD_OFFSET_X + triangleGraphicBounds.centerX) * verticalBoardScale;
          setBoardScale(stackedTriangleScale);
          setPlayerNarrowScale(narrowScale > 0 ? narrowScale : 1);
          setPlayerClueStackScale(stackedClueScale > 0 ? stackedClueScale : PLAYER_STACKED_CLUE_SCALE);
          setBoardOffsetX(shellWidth / 2 - visualGraphicCenterX);
        } else {
          setBoardScale(horizontalBoardScale > 0 ? horizontalBoardScale : 1);
          setPlayerNarrowScale(horizontalLayoutScale > 0 ? horizontalLayoutScale : 1);
          setPlayerClueStackScale(horizontalLayoutScale > 0 ? horizontalLayoutScale : 1);
          setBoardOffsetX(horizontalBoardOffsetX);
        }

        let clueCenterY = shellHeight / 2;
        if (clueStackRef.current && boardShellRef.current) {
          const clueRect = clueStackRef.current.getBoundingClientRect();
          const shellRect = boardShellRef.current.getBoundingClientRect();
          clueCenterY = (clueRect.top + clueRect.bottom) / 2 - shellRect.top;
        }

        if (stackedLayout) {
          const verticalBoardScale = stackedTriangleScale * narrowScale;
          const stackedClueScale = narrowScale * PLAYER_STACKED_CLUE_SCALE;
          const visualGraphicHeight = graphicHeight * verticalBoardScale;
          const visualClueHeight = measuredClueHeight * stackedClueScale;
          const availableHeight = Math.max(
            (window.visualViewport?.height || window.innerHeight || shellHeight) -
              62 * playerBannerScale -
              52,
            1
          );
          const visualCompositionHeight = visualGraphicHeight + stackedHintTooltipGap + visualClueHeight;
          const stackedEdgeSpace = Math.max(
            PLAYER_STACKED_BOTTOM_PADDING,
            (availableHeight - visualCompositionHeight) / 2
          );
          const graphicTopUnits = BOARD_OFFSET_Y + triangleGraphicBounds.top;
          setBoardOffsetY(stackedEdgeSpace - graphicTopUnits * verticalBoardScale);
          setPlayerStackedBoardShellHeight(stackedEdgeSpace + visualGraphicHeight + stackedHintTooltipGap);
        } else {
          const visualTriangleCenterY = (BOARD_OFFSET_Y + triangleGraphicBounds.centerY) * horizontalRenderedBoardScale;
          setBoardOffsetY(clueCenterY - visualTriangleCenterY);
          setPlayerStackedBoardShellHeight(260);
        }

        if (playerCluePane) {
          const paneRect = playerCluePane.getBoundingClientRect();
          const paneStyles = window.getComputedStyle(playerCluePane);
          const panePaddingLeft = parseFloat(paneStyles.paddingLeft || "0");
          const panePaddingRight = parseFloat(paneStyles.paddingRight || "0");
          const contentWidth = Math.max(paneRect.width - panePaddingLeft - panePaddingRight, 0);
          const availableStackWidth = Math.min(contentWidth || PLAYER_CLUE_STACK_MAX_WIDTH, PLAYER_CLUE_STACK_MAX_WIDTH);
          const renderedStackWidth = clueStackRef.current?.offsetWidth || availableStackWidth;
          const activeLayoutScale = stackedLayout ? narrowScale * PLAYER_STACKED_CLUE_SCALE : horizontalLayoutScale;
          const visualStackWidth = (stackedLayout ? PLAYER_CLUE_STACK_MAX_WIDTH : renderedStackWidth) * activeLayoutScale;
          const targetLeft = stackedLayout
            ? contentWidth / 2 - visualStackWidth / 2
            : 0;
          const boundedLeft = stackedLayout
            ? Math.min(targetLeft, Math.max(contentWidth - visualStackWidth, 0))
            : targetLeft;
          const nextClueStackOffsetX = stackedLayout ? Math.max(boundedLeft, 0) : boundedLeft;
          setClueStackOffsetX(nextClueStackOffsetX);
          const contentLeftPageX = paneRect.left + panePaddingLeft - pageLeft;
          const clueCenterPageX = contentLeftPageX + nextClueStackOffsetX + visualStackWidth / 2;
          const actionRect = playerHeaderActionsRef.current?.getBoundingClientRect();
          const clearRect = clearButtonRef.current?.getBoundingClientRect();
          const clearCenterOffset = actionRect && clearRect
            ? (clearRect.left + clearRect.right - actionRect.left - actionRect.right) / 2
            : 0;
          const targetActionCenterPageX = clueCenterPageX - clearCenterOffset;
          setPlayerHeaderActionsCenterX(
            stackedLayout
              ? null
              : (targetActionCenterPageX - PLAYER_TOP_BAR_HORIZONTAL_PADDING) / Math.max(playerBannerScale, 0.001)
          );
        } else {
          setClueStackOffsetX(0);
          setPlayerHeaderActionsCenterX(null);
        }
        setReadyPlayerLayoutKey(playerLayoutKey);
        window.requestAnimationFrame(() => {
          setSettledPlayerLayoutKey(playerLayoutKey);
        });
        return;
      }

      const nextScale = Math.min(shellWidth / BOARD_WIDTH, shellHeight / BOARD_HEIGHT);
      const safe = nextScale > 0 ? nextScale : 1;
      const editorScale = safe * EDITOR_RENDER_SCALE;
      setBoardScale(editorScale);
      setEditorBoardSize({
        width: Math.max(1800, shellWidth / Math.max(editorScale, 0.001)),
        height: Math.max(900, shellHeight / Math.max(editorScale, 0.001)),
      });
      setBoardOffsetX(0);
      setBoardOffsetY(0);
      setClueStackOffsetX(0);
      setPlayerNarrowScale(1);
      setPlayerClueStackScale(1);
      setPlayerStackedBoardShellHeight(260);
      playerStackedLayoutRef.current = false;
      setIsPlayerStackedLayout(false);
      setHidePlayerModeToggle(false);
      setPlayerTimerCenterX(null);
      setPlayerHeaderActionsCenterX(null);
      setPlayerHorizontalTracks({
        boardColumn: 920,
        clueColumn: 520,
        gap: PLAYER_BOARD_CLUE_GAP,
      });
      setReadyPlayerLayoutKey("");
      setSettledPlayerLayoutKey("");
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(pane);
    observer.observe(shell);
    if (playerCluePane) observer.observe(playerCluePane);
    if (clueStackRef.current) observer.observe(clueStackRef.current);
    window.visualViewport?.addEventListener("resize", updateScale);
    window.addEventListener("resize", updateScale);

    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", updateScale);
      window.removeEventListener("resize", updateScale);
    };
  }, [
    mode,
    playerLayoutKey,
    clues.length,
    playerBannerScale,
    squares,
    stackedHintTooltipGap,
    triangleGraphicBounds,
    showHowToPlay,
  ]);

  useEffect(() => {
    if (mode !== "player" || showHowToPlay) return;
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
  }, [mode, clues.length, playerBannerScale, squares, triangleGraphicBounds, showHowToPlay]);

  useEffect(() => {
    if (mode !== "player" || showHowToPlay) return undefined;

    const updateMetrics = () => {
      const stackWidth = clueStackRef.current?.clientWidth || 440;
      const clueHeight = clueRefs.current[0]?.clientHeight || CLUE_BOX_HEIGHT;
      setPlayerClueMetrics({ width: stackWidth, height: clueHeight });
    };

    updateMetrics();

    const observer = new ResizeObserver(updateMetrics);
    if (clueStackRef.current) observer.observe(clueStackRef.current);
    if (clueRefs.current[0]) observer.observe(clueRefs.current[0]);
    window.addEventListener("resize", updateMetrics);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateMetrics);
    };
  }, [mode, playerClues, showHowToPlay]);

  useEffect(() => {
    const updateBannerScale = () => {
      const browserZoom = window.visualViewport?.scale || 1;
      setPlayerBannerScale(PLAYER_BANNER_TARGET_BROWSER_ZOOM / browserZoom);
    };

    updateBannerScale();

    window.visualViewport?.addEventListener("resize", updateBannerScale);
    window.addEventListener("resize", updateBannerScale);

    return () => {
      window.visualViewport?.removeEventListener("resize", updateBannerScale);
      window.removeEventListener("resize", updateBannerScale);
    };
  }, []);

  const boardData = useMemo(() => inferBoardData(squares), [squares]);
  const selectedSquare = useMemo(
    () => squares.find((sq) => sq.id === selectedId) || null,
    [squares, selectedId]
  );

  const activeSide = useMemo(() => {
    if (!selectedSquare) return "base";
    const role = boardData.squareRoleById?.[selectedSquare.id] || null;
    return role?.kind === "side" ? role.side : lastSide;
  }, [selectedSquare, boardData, lastSide]);
  useEffect(() => {
    if (selectedId && !squares.some((sq) => sq.id === selectedId)) {
      setSelectedId(getPreferredSelectedSquareId(squares));
    }
    setSelectedIds((prev) => prev.filter((id) => squares.some((sq) => sq.id === id)));
  }, [selectedId, squares]);

  useEffect(() => {
    setPlayerLetters((prev) => {
      const next = {};
      squares.forEach((sq) => {
        next[sq.id] = prev[sq.id] || "";
      });
      return next;
    });
  }, [squares]);

  useEffect(() => {
    if (!selectedSquare) return;
    const role = boardData.squareRoleById?.[selectedSquare.id] || null;
    if (role?.kind === "side") setLastSide(role.side);
  }, [selectedSquare, boardData]);

  useEffect(() => {
    if (mode !== "editor") {
      setActiveHintEditor(null);
    }
    if (mode === "editor") {
      setShowSolvedModal(false);
      setFinishedState(null);
      setIsPaused(false);
      setAssistLog([]);
      setFinishAssistLog([]);
      setPlayerLetters(buildBlankPlayerLetters(squares));
      setSeconds(0);
    }
  }, [mode, squares]);

  useEffect(() => {
    if (!finishedState) return;
    setTypingFlow(false);
    setShowRevealMenu(false);
    setShowSettingsMenu(false);
    setShowSettingsPresetMenu(false);
    setShowDebutMenu(false);
    setOpenHintSection(null);
    setActiveButton(null);
    setHoveredHintTooltip(null);
  }, [finishedState]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const isPlayerClueTarget = Object.values(clueRefs.current).some((clueEl) => clueEl?.contains(e.target));

      if (mode === "editor" && !e.target.closest("[data-square='true']")) {
        setSelectedId(null);
        setSelectedIds([]);
        setTypingFlow(false);
      }

      if (isPlayerClueTarget) return;

      if (
        !e.target.closest(".reveal-container") &&
        !e.target.closest(".hint-container") &&
        !e.target.closest(".settings-container") &&
        !e.target.closest(".preset-container") &&
        !e.target.closest(".debut-container")
      ) {
        setShowRevealMenu(false);
        setShowHintMenu(false);
        setShowSettingsMenu(false);
        setShowSettingsPresetMenu(false);
        setShowDebutMenu(false);
        setShowPresetMenu(false);
        setOpenHintSection(null);
        setActiveButton(null);
        setHoveredHintTooltip(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mode]);

  useEffect(() => {
    if (showHintMenu) return undefined;
    if (hintTooltipTimeoutRef.current) {
      window.clearTimeout(hintTooltipTimeoutRef.current);
      hintTooltipTimeoutRef.current = null;
    }
    hintHoverOriginRef.current = null;
    setHoveredHintTooltip(null);
    return undefined;
  }, [showHintMenu]);

  useEffect(
    () => () => {
      if (hintTooltipTimeoutRef.current) {
        window.clearTimeout(hintTooltipTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== "Escape" || mode !== "editor") return;

      setSelectedId(null);
      setSelectedIds([]);
      setTypingFlow(false);
      setSelectionBox(null);
      setPendingDrag(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode]);

  useEffect(() => {
    const move = (event) => {
      const toBoardPoint = (clientX, clientY, boardRect) => ({
        x: (clientX - boardRect.left) / renderedBoardScale,
        y: (clientY - boardRect.top) / renderedBoardScale,
      });
      if (pendingDrag && !dragState) {
        const dx = event.clientX - pendingDrag.startClientX;
        const dy = event.clientY - pendingDrag.startClientY;
        if (Math.hypot(dx, dy) < 6) return;

        const square = squares.find((sq) => sq.id === pendingDrag.squareId);
        const boardRect = boardRef.current?.getBoundingClientRect();
        if (!square || !boardRect) return;

        const dragIds = selectedIds.includes(square.id) && selectedIds.length > 1 ? [...selectedIds] : [square.id];
        const pointer = toBoardPoint(event.clientX, event.clientY, boardRect);
        const draggedSquares = squares.filter((sq) => dragIds.includes(sq.id));
        const minX = Math.min(...draggedSquares.map((sq) => sq.x));
        const maxX = Math.max(...draggedSquares.map((sq) => sq.x));
        const minY = Math.min(...draggedSquares.map((sq) => sq.y));
        const maxY = Math.max(...draggedSquares.map((sq) => sq.y));

        setSelectedId(square.id);
        setSelectedIds(dragIds);
        setTypingFlow(false);
        setSelectionBox(null);
        setDragState({
          id: square.id,
          ids: dragIds,
          squareType: square.type,
          isNew: false,
          pointerOffset: {
            x: pointer.x - BOARD_OFFSET_X - square.x,
            y: pointer.y - BOARD_OFFSET_Y - square.y,
          },
          anchorId: square.id,
          originById: Object.fromEntries(
            draggedSquares.map((sq) => [sq.id, { x: sq.x, y: sq.y, type: sq.type, letter: sq.letter }])
          ),
          bounds: { minX, maxX, minY, maxY },
          draftX: square.x,
          draftY: square.y,
          blocked: false,
          overTrash: false,
        });
        setPendingDrag(null);
        return;
      }

      if (selectionBox) {
        const boardRect = boardRef.current?.getBoundingClientRect();
        if (!boardRect) return;
        const pointer = toBoardPoint(event.clientX, event.clientY, boardRect);
        const currentX = clamp(pointer.x - BOARD_OFFSET_X, GRID_MIN_X, editorGridMaxX + CELL_SIZE);
        const currentY = clamp(pointer.y - BOARD_OFFSET_Y, GRID_MIN_Y, editorGridMaxY + CELL_SIZE);
        setSelectionBox((prev) => (prev ? { ...prev, currentX, currentY } : prev));
        return;
      }

      if (!dragState) return;
      const boardRect = boardRef.current?.getBoundingClientRect();
      if (!boardRect) return;

      const anchorOrigin = dragState.originById?.[dragState.anchorId];
      if (!anchorOrigin) return;

      const pointer = toBoardPoint(event.clientX, event.clientY, boardRect);
      const rawX = pointer.x - BOARD_OFFSET_X - dragState.pointerOffset.x;
      const rawY = pointer.y - BOARD_OFFSET_Y - dragState.pointerOffset.y;
      const snapped = snapTopLeft(rawX, rawY);

      const unclampedDx = snapped.x - anchorOrigin.x;
      const unclampedDy = snapped.y - anchorOrigin.y;
      const minDx = GRID_MIN_X - dragState.bounds.minX;
      const maxDx = editorGridMaxX - dragState.bounds.maxX;
      const minDy = GRID_MIN_Y - dragState.bounds.minY;
      const maxDy = editorGridMaxY - dragState.bounds.maxY;
      const dx = clamp(unclampedDx, minDx, maxDx);
      const dy = clamp(unclampedDy, minDy, maxDy);

      const proposedRects = (dragState.ids || [dragState.id]).map((id) => {
        const origin = dragState.originById[id];
        return { id, x: origin.x + dx, y: origin.y + dy };
      });

      const overlapping = proposedRects.some((rect) =>
        squares.some((sq) => !(dragState.ids || [dragState.id]).includes(sq.id) && rectsOverlap(rect, sq))
      );

      let overTrash = false;
      const trashRect = trashRef.current?.getBoundingClientRect();
      if (trashRect) {
        overTrash =
          event.clientX >= trashRect.left &&
          event.clientX <= trashRect.right &&
          event.clientY >= trashRect.top &&
          event.clientY <= trashRect.bottom;
      }

      setDragState((prev) =>
        prev
          ? {
              ...prev,
              draftX: anchorOrigin.x + dx,
              draftY: anchorOrigin.y + dy,
              draftPositions: Object.fromEntries(
                (dragState.ids || [dragState.id]).map((id) => {
                  const origin = dragState.originById[id];
                  return [id, { x: origin.x + dx, y: origin.y + dy }];
                })
              ),
              blocked: overlapping,
              overTrash,
            }
          : prev
      );
    };

    const up = () => {
      if (pendingDrag) {
        setPendingDrag(null);
        return;
      }

      if (selectionBox) {
        const minX = Math.min(selectionBox.startX, selectionBox.currentX);
        const maxX = Math.max(selectionBox.startX, selectionBox.currentX);
        const minY = Math.min(selectionBox.startY, selectionBox.currentY);
        const maxY = Math.max(selectionBox.startY, selectionBox.currentY);

        const hits = squares
          .filter((sq) => {
            const boundary = getSquareBoundaryShape({
              x: sq.x,
              y: sq.y,
            }).rect;
            const left = boundary.x;
            const top = boundary.y;
            const right = left + boundary.width;
            const bottom = top + boundary.height;
            return !(right < minX || left > maxX || bottom < minY || top > maxY);
          })
          .map((sq) => sq.id);

        setSelectedIds(hits);
        if (hits.length === 1) setSelectedId(hits[0]);
        setSelectionBox(null);
        return;
      }

      if (!dragState) return;

      if (dragState.overTrash) {
        if (!dragState.isNew) {
          const deletedIds = squares
            .filter((sq) => (dragState.ids || [dragState.id]).includes(sq.id) && !isCornerType(sq.type))
            .map((sq) => sq.id);

          if (deletedIds.length) {
            setSquares((prev) => prev.filter((sq) => !deletedIds.includes(sq.id)));
            setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
          }
        }
        setDragState(null);
        return;
      }

      if (!dragState.blocked) {
        if (dragState.isNew) {
          setSquares((prev) => [
            ...prev,
            {
              id: dragState.id,
              type: dragState.squareType,
              x: dragState.draftX,
              y: dragState.draftY,
              letter: "",
            },
          ]);
          setSelectedId(dragState.id);
          setSelectedIds([dragState.id]);
        } else {
          const draftPositions = dragState.draftPositions || {
            [dragState.id]: { x: dragState.draftX, y: dragState.draftY },
          };
          setSquares((prev) =>
            prev.map((sq) => (draftPositions[sq.id] ? { ...sq, x: draftPositions[sq.id].x, y: draftPositions[sq.id].y } : sq))
          );
          setSelectedId(dragState.id);
          setSelectedIds(dragState.ids || [dragState.id]);
        }
      }

      setDragState(null);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [renderedBoardScale, dragState, editorGridMaxX, editorGridMaxY, pendingDrag, selectionBox, selectedIds, squares]);

  useEffect(() => {
    const active = inputRefs.current[selectedId];
    if (selectedId && active && !isPlayerInputLocked) active.focus();
  }, [isPlayerInputLocked, selectedId, mode]);

  useEffect(() => {
    if (!isPlayerInputLocked || typeof document === "undefined") return;
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLInputElement) {
      activeElement.blur();
    }
  }, [isPlayerInputLocked]);

  const startDraggingExisting = (event, square) => {
    if (mode !== "editor") return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(square.id);
    if (!selectedIds.includes(square.id)) setSelectedIds([square.id]);
    setTypingFlow(false);
    setSelectionBox(null);
    setPendingDrag({
      squareId: square.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
    });
  };

  const handleBoardMouseDown = (event) => {
    if (mode !== "editor") return;
    setPendingDrag(null);
    if (
      event.target.closest("[data-square='true']") ||
      event.target.closest("button") ||
      event.target.closest("input") ||
      event.target.closest("textarea")
    ) {
      return;
    }

    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;

    const pointer = {
      x: (event.clientX - boardRect.left) / renderedBoardScale,
      y: (event.clientY - boardRect.top) / renderedBoardScale,
    };
    const startX = clamp(pointer.x - BOARD_OFFSET_X, GRID_MIN_X, editorGridMaxX + CELL_SIZE);
    const startY = clamp(pointer.y - BOARD_OFFSET_Y, GRID_MIN_Y, editorGridMaxY + CELL_SIZE);
    setSelectedIds([]);
    setSelectionBox({ startX, startY, currentX: startX, currentY: startY });
  };

  const startDraggingPalette = (_event, type) => {
    if (mode !== "editor") return;
    if (isCornerType(type)) return;
    const id = `sq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    for (let y = GRID_MIN_Y; y <= editorGridMaxY; y += SNAP) {
      for (let x = GRID_MIN_X; x <= editorGridMaxX; x += SNAP) {
        const snapped = snapTopLeft(x, y);
        const overlapping = squares.some((sq) => rectsOverlap({ x: snapped.x, y: snapped.y }, sq));
        if (!overlapping) {
          setSquares((prev) => [...prev, { id, type, x: snapped.x, y: snapped.y, letter: "" }]);
          setSelectedId(id);
          return;
        }
      }
    }
  };

  const setSquareLetter = (id, value) => {
    setSquares((prev) => prev.map((sq) => (sq.id === id ? { ...sq, letter: value } : sq)));
  };

  const setPlayerLetter = (id, value) => {
    setPlayerLetters((prev) => ({ ...prev, [id]: value }));
  };

  const findTypingIndex = (id) => boardData.typingOrder.indexOf(id);

  const getTypingNeighbor = (id, direction) => {
    const order = boardData.typingOrder;
    const index = findTypingIndex(id);
    if (index === -1 || !order.length) return null;
    return direction === "next"
      ? order[(index + 1) % order.length] || null
      : order[(index - 1 + order.length) % order.length] || null;
  };

  const getLetterFlowNeighbor = (id, direction) => {
    const role = boardData.squareRoleById?.[id] || null;
    const side = role?.kind === "side" ? role.side : null;

    if (side) {
      const map = direction === "next" ? boardData.insertionNextBySide : boardData.deletionNextBySide;
      return map?.[side]?.[id] || null;
    }

    if (role?.kind === "corner" && role.corner === "bottomLeft") {
      return direction === "next" ? boardData.insertionNextBySide?.[activeSide]?.[id] || null : null;
    }

    if (role?.kind === "corner" && role.corner === "top") {
      const map = direction === "next" ? boardData.insertionNextBySide : boardData.deletionNextBySide;
      return map?.[activeSide]?.[id] || null;
    }

    if (role?.kind === "corner" && role.corner === "bottomRight") {
      return direction === "prev" ? boardData.deletionNextBySide?.[activeSide]?.[id] || null : null;
    }

    return null;
  };

  const getCornerActivationOverride = (cornerRole) => {
    const overrideMap = {
      base: { top: "right" },
      left: { bottomRight: "base" },
      right: { bottomLeft: "base" },
    };

    return overrideMap[activeSide]?.[cornerRole] || null;
  };

  const getLeadingCornerIdForSide = (side) => {
    const isVertical = boardData.sideRules?.[side]?.isVertical;
    const endpoints = getSideReadingEndpoints(side, isVertical);
    return boardData.cornerIdByRole?.[endpoints?.startCorner] || null;
  };

  const handlePlayerSquareActivate = (squareId) => {
    if (isPlayerInputLocked) return;
    setSelectedId(squareId);
    setTypingFlow(false);

    const role = boardData.squareRoleById?.[squareId] || null;
    if (role?.kind === "corner") {
      const overrideSide = getCornerActivationOverride(role.corner);
      if (overrideSide) {
        setLastSide(overrideSide);
      }
    }
  };

  const handlePlayerClueActivate = (index) => {
    if (isPlayerInputLocked) return;

    const side = CLUE_SIDE_KEYS[index];
    if (!side) return;

    const targetId = getLeadingCornerIdForSide(side);
    if (!targetId) return;

    setLastSide(side);
    handlePlayerSquareActivate(targetId);

    window.requestAnimationFrame(() => {
      inputRefs.current[targetId]?.focus();
    });
  };

  const handlePlayerClueMouseDown = (event, index) => {
    if (event.button !== 0) return;
    clearPendingHintTooltip();
    playerCluePointerRef.current = {
      index,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePlayerClueClick = (event, index) => {
    const pointer = playerCluePointerRef.current;
    playerCluePointerRef.current = null;

    if (pointer?.index === index) {
      const dragDistance = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y);
      if (dragDistance > 4) return;
    }

    const selection = window.getSelection?.();
    if (selection && !selection.isCollapsed) {
      const anchorNode = selection.anchorNode;
      const focusNode = selection.focusNode;
      if (
        (anchorNode && event.currentTarget.contains(anchorNode)) ||
        (focusNode && event.currentTarget.contains(focusNode))
      ) {
        return;
      }
    }

    handlePlayerClueActivate(index);
  };

  const handleSquareKeyAction = (key, squareId) => {
    if (!squareId) return false;

    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) {
      const direction = key.replace("Arrow", "").toLowerCase();
      const nextId = getDirectionalNextSquare(boardData, squareId, direction);
      if (nextId) setSelectedId(nextId);
      return true;
    }

    if (key === "Tab") return false;

    if (key === "Backspace") {
      if (mode === "editor") {
        setSquareLetter(squareId, "");
      } else {
        setPlayerLetter(squareId, "");
      }
      const nextId = typingFlow ? getTypingNeighbor(squareId, "prev") : getLetterFlowNeighbor(squareId, "prev");
      if (nextId) setSelectedId(nextId);
      return true;
    }

    if (key.length === 1 && /[a-zA-Z]/.test(key)) {
      if (mode === "editor") {
        setSquareLetter(squareId, key.toUpperCase());
      } else {
        setPlayerLetter(squareId, key.toUpperCase());
      }
      const nextId = typingFlow ? getTypingNeighbor(squareId, "next") : getLetterFlowNeighbor(squareId, "next");
      if (nextId) setSelectedId(nextId);
      return true;
    }

    return false;
  };

  const handleSquareKeyDown = (event, square) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (mode === "player" && isPlayerInputLocked) {
      event.preventDefault();
      return;
    }

    if (isEditorContentLocked) {
      event.preventDefault();
      return;
    }

    if (mode === "player" && finishedState) {
      if (["Backspace", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) || (event.key.length === 1 && /[a-zA-Z]/.test(event.key))) {
        event.preventDefault();
      }
      return;
    }

    const key = event.key;

    if (handleSquareKeyAction(key, square.id)) {
      event.preventDefault();
    }
  };

  useEffect(() => {
    if (mode !== "editor" || isEditorContentLocked) return undefined;

    const handleEditorTyping = (event) => {
      if (!selectedSquare || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLButtonElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (handleSquareKeyAction(event.key, selectedSquare.id)) {
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleEditorTyping);
    return () => window.removeEventListener("keydown", handleEditorTyping);
  }, [mode, isEditorContentLocked, selectedSquare, typingFlow, boardData, activeSide]);

  const handleSquareInputChange = (id, raw) => {
    if (mode === "player" && (finishedState || isPlayerInputLocked)) return;
    if (isEditorContentLocked) return;

    const value = (raw || "").slice(-1).toUpperCase().replace(/[^A-Z]/g, "");
    if (mode === "editor") {
      setSquareLetter(id, value);
    } else {
      setPlayerLetter(id, value);
    }
  };

  const enterPlayerMode = () => {
    setSelectedId(getPreferredSelectedSquareId(squares));
    setSelectedIds([]);
    setLastSide("base");
    setMode("player");
    setShowHowToPlay(false);
    setTypingFlow(false);
    setShowSettingsPresetMenu(false);
    setShowDebutMenu(false);
  };

  const enterEditorMode = () => {
    if (!isLocalEditorEnabled) {
      enterPlayerMode();
      return;
    }

    setMode("editor");
    setShowHowToPlay(false);
    setTypingFlow(false);
    setShowHintMenu(false);
    setShowRevealMenu(false);
    setShowSettingsMenu(false);
    setShowSettingsPresetMenu(false);
    setShowDebutMenu(false);
    setOpenHintSection(null);
    setActiveButton(null);
  };

  const promptForAuthoringLogin = async () => {
    if (isAuthoringAuthBusy) return;
    const password = window.prompt("Enter the authoring password");
    if (!password) return;

    setIsAuthoringAuthBusy(true);
    try {
      const session = await loginAuthoring(password);
      setAuthoringAuth({
        checked: true,
        authenticated: Boolean(session?.authenticated),
        authRequired: Boolean(session?.authRequired),
      });
      setPuzzleActionStatus("Publishing unlocked");
    } catch {
      setPuzzleActionStatus("Authoring password rejected");
    } finally {
      setIsAuthoringAuthBusy(false);
    }
  };

  const handleAuthoringLogout = async () => {
    if (isAuthoringAuthBusy) return;
    setIsAuthoringAuthBusy(true);
    try {
      const session = await logoutAuthoring();
      setAuthoringAuth({
        checked: true,
        authenticated: Boolean(session?.authenticated),
        authRequired: Boolean(session?.authRequired),
      });
      setPuzzleActionStatus("Publishing locked");
    } catch {
      setPuzzleActionStatus("Could not lock publishing");
    } finally {
      setIsAuthoringAuthBusy(false);
    }
  };

  const applyLoadedPuzzle = (puzzle, nextPuzzleName = "Untitled Puzzle", options = {}) => {
    const { nextMode = "editor", preserveDebutMenu = false, nextPuzzleSource = null } = options;
    const normalized = normalizePuzzleState(puzzle);
    setSquares(normalized.squares);
    setClues(normalized.clues);
    setSelectedId(getPreferredSelectedSquareId(normalized.squares));
    setSelectedIds([]);
    setLastSide("base");
    setPlayerLetters(buildBlankPlayerLetters(normalized.squares));
    setSeconds(0);
    setHasStartedGame(false);
    setShowStartModal(true);
    setIsPaused(false);
    setShowSolvedModal(false);
    setFinishedState(null);
    setAssistLog([]);
    setFinishAssistLog([]);
    setShowHintMenu(false);
    setShowRevealMenu(false);
    setShowSettingsMenu(false);
    setShowSettingsPresetMenu(false);
    if (!preserveDebutMenu) {
      setShowDebutMenu(false);
    }
    setOpenHintSection(null);
    setActiveButton(null);
    setTypingFlow(false);
    setSelectionBox(null);
    setPendingDrag(null);
    setDragState(null);
    setHoveredHintTooltip(null);
    setActiveHintEditor(null);
    setActiveClueIndex(0);
    setCurrentPuzzleName(nextPuzzleName);
    setCurrentPuzzleSource(nextPuzzleSource);
    setShowWelcomeBackModal(false);
    setMode(nextMode === "editor" && isLocalEditorEnabled ? "editor" : "player");
  };

  const readPuzzleFromFile = async (file) => {
    if (!/\.try$/i.test(file.name)) {
      throw new Error("Only .try files are supported.");
    }

    const raw = await file.text();
    const parsed = JSON.parse(raw);
    return {
      fileName: file.name,
      name: parsed?.name || puzzleNameFromFileName(file.name),
      puzzle: parsed?.puzzle ?? parsed,
    };
  };

  const setPresetFromPuzzleFile = async (slot, file) => {
    const loaded = await readPuzzleFromFile(file);
    const normalizedPuzzle = normalizePuzzleState(loaded.puzzle);
    const preset = {
      name: loaded.name,
      fileName: loaded.fileName,
      puzzle: serializePuzzleState(normalizedPuzzle.squares, normalizedPuzzle.clues),
      updatedAt: new Date().toISOString(),
    };
    const nextPresets = { ...puzzlePresets, [slot.id]: preset };
    setPuzzlePresets(nextPresets);
    writeStoredPuzzlePresets(nextPresets);
    try {
      const result = await savePuzzlePresets(nextPresets);
      const prefix =
        slot.id === PUZZLE_PRESET_SLOTS[0].id
          ? `${slot.label} set to ${loaded.fileName}. This is the game default whenever no triangle debut is active.`
          : `${slot.label} set to ${loaded.fileName}.`;
      setPuzzleActionStatus(result?.publish?.ok === false ? `${prefix} ${result.publish.message}` : prefix);
    } catch {
      setPuzzleActionStatus("Saved the preset locally in this session, but could not write the repo-backed preset config.");
    }
  };

  const handlePresetLoad = (slot) => {
    const preset = puzzlePresets[slot.id];
    setShowSettingsPresetMenu(false);
    setShowSettingsMenu(false);
    setActiveButton(null);
    if (!preset) return;

    applyLoadedPuzzle(preset.puzzle, preset.name || slot.label, {
      nextMode: "player",
      nextPuzzleSource: buildPlaytestPuzzleSourceDescriptor(slot, preset),
    });
    setShowHowToPlay(false);
    setPuzzleActionStatus(`Loaded ${slot.label}.`);
  };

  const resetDebutForm = () => {
    const defaults = buildDefaultTriangleDebutInputs();
    setSelectedDebutId(null);
    setDebutDateInput(defaults.date);
    setDebutTimeInput(defaults.time);
    setSelectedDebutFileName("");
  };

  const handleDebutItemSelect = (entry) => {
    setSelectedDebutId(entry.id);
    setDebutDateInput(formatDateInputValue(new Date(entry.startsAt)));
    setDebutTimeInput(formatTimeInputValue(new Date(entry.startsAt)));
    setSelectedDebutFileName(entry.fileName || puzzleFileNameFromName(entry.name || "Untitled Puzzle"));
    applyLoadedPuzzle(entry.puzzle, entry.name || "Untitled Puzzle", {
      nextMode: "editor",
      preserveDebutMenu: true,
      nextPuzzleSource: buildEditorPuzzleSourceDescriptor(entry.name || "Untitled Puzzle"),
    });
    setShowDebutMenu(true);
    setShowPresetMenu(false);
    setPuzzleActionStatus(`Loaded scheduled debut ${getDebutDisplayName(entry)} into the editor.`);
  };

  const handleSelectDebutFile = async () => {
    if (!supportsNativeFilePickers()) {
      setPuzzleActionStatus("Debut scheduling needs a browser with .try file picker support.");
      return;
    }

    try {
      suppressBannerDropdownCloseRef.current = true;
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: "Tryptic Puzzle Files",
            accept: {
              "application/x-tryptic-puzzle+json": [".try"],
            },
          },
        ],
      });

      if (!handle) return;
      const file = await handle.getFile();
      const loaded = await readPuzzleFromFile(file);
      const normalizedPuzzle = normalizePuzzleState(loaded.puzzle);
      setSelectedDebutId(null);
      setSelectedDebutFileName(loaded.fileName);
      setDebutDateInput((prev) => prev || buildDefaultTriangleDebutInputs().date);
      setDebutTimeInput((prev) => prev || buildDefaultTriangleDebutInputs().time);
      applyLoadedPuzzle(normalizedPuzzle, loaded.name, {
        nextMode: "editor",
        preserveDebutMenu: true,
        nextPuzzleSource: buildEditorPuzzleSourceDescriptor(loaded.name),
      });
      setPuzzleActionStatus(`Loaded ${loaded.fileName}`);
    } catch (error) {
      if (!isAbortError(error)) {
        setPuzzleActionStatus("Could not load that debut file. Choose a .try file.");
      }
    } finally {
      window.setTimeout(() => {
        suppressBannerDropdownCloseRef.current = false;
      }, 0);
    }
  };

  const handleSaveTriangleDebut = async () => {
    const startAt = buildLocalDateFromInputs(debutDateInput, debutTimeInput);
    if (!startAt) {
      setPuzzleActionStatus("Choose a valid debut date and time.");
      return;
    }

    if (!selectedDebutId && !selectedDebutFileName) {
      setPuzzleActionStatus("Choose a .try file before scheduling a debut.");
      return;
    }

    const endAt = new Date(startAt.getTime() + MAX_TRIANGLE_DEBUT_DURATION_MS);
    const nextEntry = sanitizeTriangleDebutEntry({
      id: selectedDebutId,
      name: (currentPuzzleName || "Untitled Puzzle").trim() || "Untitled Puzzle",
      fileName:
        selectedDebutFileName || puzzleFileNameFromName((currentPuzzleName || "Untitled Puzzle").trim() || "Untitled Puzzle"),
      puzzle: serializePuzzleState(squares, clues),
      updatedAt: new Date().toISOString(),
      startsAt: startAt.toISOString(),
      endsAt: endAt.toISOString(),
    });

    if (!nextEntry) {
      setPuzzleActionStatus("Could not save that debut. Check the scheduled day and time.");
      return;
    }

    const nextDebuts = sortTriangleDebuts([
      ...scheduledTriangleDebuts.filter((entry) => entry.id !== nextEntry.id),
      nextEntry,
    ]);

    setScheduledTriangleDebuts(nextDebuts);
    setSelectedDebutId(nextEntry.id);
    try {
      const result = await saveTriangleDebuts(nextDebuts);
      const prefix = selectedDebutId
        ? `Updated ${getDebutDisplayName(nextEntry)}`
        : `Scheduled ${getDebutDisplayName(nextEntry)}`;
      setPuzzleActionStatus(
        result?.publish?.ok === false ? `${prefix} ${result.publish.message}` : prefix
      );
    } catch {
      setPuzzleActionStatus("Saved the debut locally in this session, but could not write the repo-backed debut schedule.");
    }
  };

  const handleDeleteTriangleDebut = async () => {
    if (!selectedDebutId) return;

    const removedEntry = scheduledTriangleDebuts.find((entry) => entry.id === selectedDebutId);
    const nextDebuts = scheduledTriangleDebuts.filter((entry) => entry.id !== selectedDebutId);
    const nextActiveDebut = getActiveTriangleDebut(nextDebuts);
    const removedWasLive = Boolean(
      removedEntry &&
        new Date(removedEntry.startsAt).getTime() <= Date.now() &&
        Date.now() < new Date(removedEntry.endsAt).getTime()
    );
    setScheduledTriangleDebuts(nextDebuts);
    resetDebutForm();
    if (removedWasLive) {
      if (nextActiveDebut) {
        applyLoadedPuzzle(nextActiveDebut.puzzle, nextActiveDebut.name || "Untitled Puzzle", {
          nextMode: "editor",
          preserveDebutMenu: true,
          nextPuzzleSource: buildEditorPuzzleSourceDescriptor(nextActiveDebut.name || "Untitled Puzzle"),
        });
      } else {
        const fallbackPreset = puzzlePresets[PUZZLE_PRESET_SLOTS[0].id];
        if (fallbackPreset) {
          applyLoadedPuzzle(fallbackPreset.puzzle, fallbackPreset.name || PUZZLE_PRESET_SLOTS[0].label, {
            nextMode: "editor",
            preserveDebutMenu: true,
            nextPuzzleSource: buildEditorPuzzleSourceDescriptor(
              fallbackPreset.name || PUZZLE_PRESET_SLOTS[0].label
            ),
          });
        }
      }
    }
    try {
      const result = await saveTriangleDebuts(nextDebuts);
      const prefix = removedWasLive
        ? nextActiveDebut
          ? `Deleted ${getDebutDisplayName(removedEntry)}`
          : `Deleted ${getDebutDisplayName(removedEntry)}`
        : `Deleted ${getDebutDisplayName(removedEntry)}`.trim();
      setPuzzleActionStatus(result?.publish?.ok === false ? `${prefix}. ${result.publish.message}` : prefix);
    } catch {
      setPuzzleActionStatus(
        removedWasLive
          ? "Removed the live debut locally in this session, but could not write the repo-backed debut schedule."
          : "Removed the debut locally in this session, but could not write the repo-backed debut schedule."
      );
    }
  };

  const handlePresetSet = async (slot) => {
    setShowPresetMenu(false);
    if (supportsNativeFilePickers()) {
      setIsSettingPreset(true);
      try {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: "Tryptic Puzzle Files",
              accept: {
                "application/x-tryptic-puzzle+json": [".try"],
              },
            },
          ],
        });
        if (!handle) return;
        const file = await handle.getFile();
        await setPresetFromPuzzleFile(slot, file);
      } catch (error) {
        if (!isAbortError(error)) {
          setPuzzleActionStatus("Could not set that preset. Choose a .try file.");
        }
      } finally {
        setIsSettingPreset(false);
      }
      return;
    }

    setPuzzleActionStatus("Preset setting needs a browser with .try file picker support.");
  };

  const handleSavePuzzle = async () => {
    if (isEditorContentLocked) return;

    const name = (currentPuzzleName || "Untitled Puzzle").trim() || "Untitled Puzzle";

    const payload = {
      name,
      puzzle: serializePuzzleState(squares, clues),
    };

    try {
      if (supportsNativeFilePickers()) {
        const handle = await window.showSaveFilePicker({
          suggestedName: puzzleFileNameFromName(name),
          types: [
            {
              description: "Tryptic Puzzle Files",
              accept: {
                "application/x-tryptic-puzzle+json": [".try"],
              },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(payload, null, 2));
        await writable.close();
        setCurrentPuzzleName(puzzleNameFromFileName(handle.name));
        setPuzzleActionStatus(`Saved ${handle.name}.`);
        return;
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/x-tryptic-puzzle+json",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = puzzleFileNameFromName(name);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setCurrentPuzzleName(name);
      setPuzzleActionStatus(`Downloaded ${puzzleFileNameFromName(name)}.`);
    } catch (error) {
      if (isAbortError(error)) return;

      try {
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/x-tryptic-puzzle+json",
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = puzzleFileNameFromName(name);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        setCurrentPuzzleName(name);
        setPuzzleActionStatus(`Downloaded ${puzzleFileNameFromName(name)}.`);
      } catch {
        setPuzzleActionStatus("Could not save the puzzle file.");
      }
    }
  };

  const readPuzzleFile = async (file) => {
    const loaded = await readPuzzleFromFile(file);
    applyLoadedPuzzle(loaded.puzzle, loaded.name, {
      nextPuzzleSource: buildEditorPuzzleSourceDescriptor(loaded.name),
    });
    setPuzzleActionStatus(`Loaded ${file.name}.`);
  };

  const handleLoadPuzzleClick = async () => {
    if (isEditorContentLocked) return;

    if (supportsNativeFilePickers()) {
      setIsLoadingPuzzle(true);
      try {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: "Tryptic Puzzle Files",
              accept: {
                "application/x-tryptic-puzzle+json": [".try"],
              },
            },
          ],
        });
        if (!handle) return;
        const file = await handle.getFile();
        await readPuzzleFile(file);
      } catch (error) {
        if (!isAbortError(error)) {
          setPuzzleActionStatus("Could not load that puzzle file.");
        }
      } finally {
        setIsLoadingPuzzle(false);
      }
      return;
    }

    loadPuzzleInputRef.current?.click();
  };

  const handleLoadPuzzle = async (event) => {
    if (isEditorContentLocked) return;

    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoadingPuzzle(true);
    try {
      await readPuzzleFile(file);
    } catch {
      setPuzzleActionStatus("Could not load that .try file.");
    } finally {
      if (event.target) {
        event.target.value = "";
      }
      setIsLoadingPuzzle(false);
    }
  };

  const clearPuzzle = () => {
    if (isPlayerFinished) return;
    setPlayerLetters(buildBlankPlayerLetters(squares));
  };

  const revealSquare = () => {
    if (!selectedSquare) return;
    setPlayerLetter(selectedSquare.id, selectedSquare.letter || "");
    setAssistLog((prev) => {
      const nextEntry = { type: "reveal", scope: `square-${selectedSquare.id}` };
      return hasAssistEntry(prev, nextEntry) ? prev : [...prev, nextEntry];
    });
    setShowRevealMenu(false);
    setActiveButton(null);
  };

  const revealSide = (side) => {
    const readingEndpoints = getSideReadingEndpoints(side, boardData.sideRules[side]?.isVertical);
    const ids = [
      boardData.cornerIdByRole[readingEndpoints.startCorner],
      ...boardData.sides[side].map((sq) => sq.id),
      boardData.cornerIdByRole[readingEndpoints.endCorner],
    ].filter(Boolean);
    setPlayerLetters((prev) => {
      const next = { ...prev };
      squares.forEach((sq) => {
        if (ids.includes(sq.id)) next[sq.id] = sq.letter || "";
      });
      return next;
    });
    setAssistLog((prev) => {
      const nextEntry = { type: "reveal", scope: side };
      return hasAssistEntry(prev, nextEntry) ? prev : [...prev, nextEntry];
    });
    setShowRevealMenu(false);
    setActiveButton(null);
  };

  const revealPuzzleWithHintSummary = () => {
    setPlayerLetters(
      Object.fromEntries(squares.map((sq) => [sq.id, sq.letter || ""]))
    );
    setAssistLog((prev) => {
      const revealEntry = { type: "reveal", scope: "puzzle" };
      const hintEntries = HINT_SECTIONS.flatMap((section) =>
        section.items.map((itemLabel) => ({ type: "hint", scope: `${section.heading}-${itemLabel}` }))
      );
      const additions = [revealEntry, ...hintEntries].filter((entry) => !hasAssistEntry(prev, entry));
      return additions.length ? [...prev, ...additions] : prev;
    });
    setIsPaused(true);
    setFinishedState("revealed");
    setShowSolvedModal(false);
    setShowRevealMenu(false);
    setActiveButton(null);
  };

  const executeRevealAction = (action) => {
    if (action === "square") revealSquare();
    if (action === "left") revealSide("left");
    if (action === "right") revealSide("right");
    if (action === "base") revealSide("base");
    if (action === "puzzle-with-hint-summary") revealPuzzleWithHintSummary();
  };

  const requestRevealAction = (action) => {
    if (isPlayerFinished) return;

    if (skipRevealConfirm) {
      executeRevealAction(action);
      return;
    }

    setPendingRevealAction(action);
    setShowRevealConfirmModal(true);
  };

  const confirmRevealAction = () => {
    if (pendingRevealAction) {
      executeRevealAction(pendingRevealAction);
    }
    setPendingRevealAction(null);
    setShowRevealConfirmModal(false);
  };

  const cancelRevealAction = () => {
    setPendingRevealAction(null);
    setShowRevealConfirmModal(false);
  };
  const pendingRevealLabel =
    pendingRevealAction === "square"
      ? "a square"
      : pendingRevealAction === "left" || pendingRevealAction === "right" || pendingRevealAction === "base"
        ? "a side"
        : pendingRevealAction === "puzzle-with-hint-summary"
          ? "the puzzle with hint summary"
          : "this";

  const visibleSquares = useMemo(() => {
    if (!dragState || dragState.isNew || !(dragState.ids || []).length) return squares;
    const hiddenIds = new Set(dragState.ids || []);
    return squares.filter((sq) => !hiddenIds.has(sq.id));
  }, [dragState, squares]);

  const cellStyle = (square) => {
    const isSelected = selectedId === square.id && !(mode === "player" && finishedState);
    const isGroupSelected = mode === "editor" && selectedIds.includes(square.id);
    const isCorner = boardData.cornerIds.has(square.id) || ["topCorner", "bottomLeftCorner", "bottomRightCorner"].includes(square.type);

    let background = getTypeColor(square.type, isCorner);
    if (mode === "player") {
      const LIGHT = theme.playerTileLight;
      const DARK = theme.playerTileDark;
      background = theme.playerTileBg;
      if (!isCorner) background = square.type === activeSide ? DARK : LIGHT;
    }

    return {
      position: "absolute",
      left: `${BOARD_OFFSET_X + square.x}px`,
      top: `${BOARD_OFFSET_Y + square.y}px`,
      width: `${CELL_SIZE}px`,
      height: `${CELL_SIZE}px`,
      border: "none",
      borderRadius: `${TILE_RADIUS}px`,
      background,
      color: theme.tileText,
      boxSizing: "border-box",
      boxShadow: isSelected
        ? (mode === "player"
            ? `0 0 0 4px ${theme.tileOutline}, 0 0 0 10px rgba(110,193,162,0.35)`
            : "0 0 0 4px rgba(0,0,0,0.12), 0 0 0 10px rgba(59,130,246,0.16)")
        : isGroupSelected
          ? "0 0 0 5px rgba(59,130,246,0.42), 0 0 0 12px rgba(59,130,246,0.18), inset 0 0 0 2px rgba(255,255,255,0.7)"
          : "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "visible",
      transition:
        mode === "player" && !arePlayerTransitionsReady
          ? "none"
          : "background 160ms ease, transform 140ms ease, box-shadow 140ms ease",
      transform: mode === "editor" ? "scale(1)" : isSelected ? "scale(1.06)" : "scale(1)",
      transformOrigin: "center center",
      zIndex: isSelected || isGroupSelected ? 4 : 2,
      cursor: mode === "editor" ? "grab" : "default",
      userSelect: "none",
    };
  };

  const clueStyle = (index) => {
    const side = index === 0 ? "left" : index === 1 ? "right" : "base";
    const isActive = activeSide === side;
    const horizontalPadding = 36;

    return {
      background: isActive ? theme.clueActiveBg : theme.clueInactiveBg,
      borderRadius: "26px",
      minHeight: "112px",
      height: "clamp(104px, 12.5vh, 118px)",
      padding: `14px ${horizontalPadding}px`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      fontWeight: 800,
      lineHeight: 1.16,
      letterSpacing: "-0.02em",
      color: theme.text,
      transition: mode === "player" && !arePlayerTransitionsReady ? "none" : "background 160ms ease",
      position: "relative",
      overflow: "hidden",
    };
  };

  const registerClueEditor = (index, element) => {
    clueEditorRefs.current[index] = element;
  };

  const updateClue = (index, html) => {
    setClues((prev) =>
      prev.map((clue, clueIndex) =>
        clueIndex === index
          ? {
              ...clue,
              html,
              plainText: normalizeCluePlainText(clueHtmlToPlainText(html)).toUpperCase(),
            }
          : clue
      )
    );
  };

  const handleCluePaste = (event, index) => {
    event.preventDefault();
    const pastedText = (event.clipboardData?.getData("text/plain") || "").toUpperCase();
    document.execCommand("insertText", false, pastedText);
    const editor = clueEditorRefs.current[index];
    if (editor) {
      updateClue(index, editor.innerHTML);
    }
  };

  const getActiveSelectionRange = (editor) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const commonNode = range.commonAncestorContainer;
    if (!editor.contains(commonNode)) return null;
    return range;
  };

  const clearHighlightSelection = (editor, range) => {
    const selection = window.getSelection();
    const spans = collectIntersectingHighlights(editor, range);

    if (!spans.length) {
      const anchorNode = selection?.anchorNode || range.startContainer;
      const singleSpan =
        anchorNode?.nodeType === Node.ELEMENT_NODE
          ? anchorNode.closest?.("[data-highlight-type]")
          : anchorNode?.parentElement?.closest?.("[data-highlight-type]");
      if (singleSpan && editor.contains(singleSpan)) {
        unwrapHighlightSpan(singleSpan);
      }
      return;
    }

    spans.forEach(unwrapHighlightSpan);
  };

  const syncHighlightMetadata = (editor) => {
    const normalizedByType = Object.fromEntries(
      Object.entries(HIGHLIGHT_COLORS).map(([type, color]) => [type, normalizeCssColor(color)])
    );

    Array.from(editor.querySelectorAll("span")).forEach((span) => {
      const backgroundColor = window.getComputedStyle(span).backgroundColor;
      const matchingType =
        Object.entries(normalizedByType).find(([, color]) => color === backgroundColor)?.[0] || null;

      if (matchingType) {
        span.dataset.highlightType = matchingType;
        span.style.borderRadius = "0.28em";
        span.style.padding = "0";
      } else {
        delete span.dataset.highlightType;
      }
    });
  };

  const applyClueHighlight = (highlightType, color) => {
    const editor = clueEditorRefs.current[activeClueIndex];
    if (!editor) return;

    editor.focus();
    const range = getActiveSelectionRange(editor);
    if (!range) return;

    if (!color) {
      clearHighlightSelection(editor, range);
      syncHighlightMetadata(editor);
      updateClue(activeClueIndex, editor.innerHTML);
      return;
    }

    if (range.collapsed) return;

    document.execCommand("styleWithCSS", false, true);
    document.execCommand("hiliteColor", false, color);
    syncHighlightMetadata(editor);

    updateClue(activeClueIndex, editor.innerHTML);
  };

  const handleClueContextMenu = (event, index) => {
    const target =
      event.target?.nodeType === Node.ELEMENT_NODE ? event.target : event.target?.parentElement || null;
    const highlight = target?.closest?.("[data-highlight-type]");
    if (!highlight) {
      setActiveHintEditor(null);
      return;
    }

    event.preventDefault();
    setActiveClueIndex(index);
    setActiveHintEditor({
      clueIndex: index,
      type: highlight.dataset.highlightType,
    });
  };

  const handleHighlightClick = (event, index) => {
    if (!event.metaKey && !event.ctrlKey) return;

    const target =
      event.target?.nodeType === Node.ELEMENT_NODE ? event.target : event.target?.parentElement || null;
    const highlight = target?.closest?.("[data-highlight-type]");
    if (!highlight) return;

    event.preventDefault();
    event.stopPropagation();

    const nextHintEditor = {
      clueIndex: index,
      type: highlight.dataset.highlightType,
    };

    setActiveClueIndex(index);
    setActiveHintEditor((prev) => {
      if (prev?.clueIndex === nextHintEditor.clueIndex && prev?.type === nextHintEditor.type) {
        return null;
      }
      return nextHintEditor;
    });
  };

  const updateHintText = (clueIndex, type, value) => {
    setClues((prev) =>
      prev.map((clue, index) =>
        index === clueIndex
          ? {
              ...clue,
              hints: {
                ...clue.hints,
                [type]: value,
              },
            }
          : clue
      )
    );
  };

  const clearPendingHintTooltip = () => {
    if (hintTooltipTimeoutRef.current) {
      window.clearTimeout(hintTooltipTimeoutRef.current);
      hintTooltipTimeoutRef.current = null;
    }
    hintHoverOriginRef.current = null;
  };

  const getPlayerClueSelectionSnapshot = () => {
    const selection = window.getSelection?.();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

    const selectionNodes = [selection.anchorNode, selection.focusNode].filter(Boolean);
    const isInPlayerClue = selectionNodes.some((node) =>
      Object.values(clueRefs.current).some((clueEl) => clueEl?.contains(node))
    );
    if (!isInPlayerClue) return null;

    return Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange());
  };

  const restorePlayerClueSelectionSnapshot = (ranges) => {
    if (!ranges?.length) return;
    window.requestAnimationFrame(() => {
      const selection = window.getSelection?.();
      if (!selection) return;
      selection.removeAllRanges();
      ranges.forEach((range) => {
        try {
          selection.addRange(range);
        } catch {
          // The highlighted clue DOM can be replaced by a render; stale ranges are safe to drop.
        }
      });
    });
  };

  const setHoveredHintTooltipPreservingSelection = (updater) => {
    const selectionSnapshot = getPlayerClueSelectionSnapshot();
    setHoveredHintTooltip(updater);
    restorePlayerClueSelectionSnapshot(selectionSnapshot);
  };

  const hideHintTooltip = () => {
    clearPendingHintTooltip();
    setHoveredHintTooltipPreservingSelection(null);
  };

  const scheduleHintTooltip = (event, tooltipKey, hintText) => {
    clearPendingHintTooltip();
    setHoveredHintTooltipPreservingSelection((prev) => (prev?.key === tooltipKey ? prev : null));

    const origin = { x: event.clientX, y: event.clientY };
    const boardRect = boardRef.current?.getBoundingClientRect();
    hintHoverOriginRef.current = origin;

    hintTooltipTimeoutRef.current = window.setTimeout(() => {
      const latestOrigin = hintHoverOriginRef.current;
      if (!latestOrigin) return;

      const bottomLeft = squares.find((sq) => sq.type === "bottomLeftCorner");
      const bottomRight = squares.find((sq) => sq.type === "bottomRightCorner");

      const baseLeftUnits = BOARD_OFFSET_X + (bottomLeft?.x ?? triangleGraphicBounds.left);
      const baseRightUnits =
        BOARD_OFFSET_X + ((bottomRight?.x ?? triangleGraphicBounds.right - CELL_SIZE) + CELL_SIZE);
      const baseBottomUnits = BOARD_OFFSET_Y + ((bottomLeft?.y ?? triangleGraphicBounds.bottom - CELL_SIZE) + CELL_SIZE);
      const isStackedLayout = playerStackedLayoutRef.current;
      const clueStackRect = clueStackRef.current?.getBoundingClientRect();
      const baseWidth = Math.max((baseRightUnits - baseLeftUnits) * renderedBoardScale, 180);
      const maxTooltipWidth =
        isStackedLayout && clueStackRect
          ? Math.max(clueStackRect.width, 180)
          : baseWidth;
      const hintSegments = getHintTooltipSegments(hintText);
      const tooltipWidth = getHintTooltipOuterWidth(hintSegments, maxTooltipWidth);
      const centerX = boardRect
        ? isStackedLayout && clueStackRect
          ? window.scrollX + clueStackRect.left + clueStackRect.width / 2
          : window.scrollX + boardRect.left + baseLeftUnits * renderedBoardScale + baseWidth / 2
        : window.scrollX + latestOrigin.x;
      const triangleBaseBottom = boardRect
        ? window.scrollY + boardRect.top + baseBottomUnits * renderedBoardScale
        : window.scrollY + latestOrigin.y;
      const availableStackedGap =
        isStackedLayout && clueStackRect
          ? window.scrollY + clueStackRect.top - triangleBaseBottom
          : 0;
      const availableTooltipHeight = availableStackedGap - PLAYER_STACKED_HINT_TOOLTIP_GAP * 2;
      const tooltipFontScale =
        isStackedLayout && availableStackedGap > 0
          ? getHintTooltipFontScaleForSlot(hintSegments, tooltipWidth, availableTooltipHeight)
          : 1;
      const top = boardRect
        ? isStackedLayout && clueStackRect
          ? triangleBaseBottom + PLAYER_STACKED_HINT_TOOLTIP_GAP
          : clueStackRect
            ? window.scrollY + clueStackRect.bottom
            : triangleBaseBottom + 8
        : window.scrollY + latestOrigin.y + 8;

      setHoveredHintTooltipPreservingSelection({
        key: tooltipKey,
        hintText,
        hintSegments,
        centerX,
        top,
        width: tooltipWidth,
        maxWidth: maxTooltipWidth,
        fontScale: tooltipFontScale,
      });
      hintTooltipTimeoutRef.current = null;
    }, HINT_TOOLTIP_HOVER_DELAY_MS);
  };

  const handleHintTooltipPointerMove = (event, tooltipKey) => {
    const origin = hintHoverOriginRef.current;
    const dx = event.clientX - (origin?.x ?? event.clientX);
    const dy = event.clientY - (origin?.y ?? event.clientY);
    const movedFar = Math.hypot(dx, dy) > HINT_TOOLTIP_MOVE_TOLERANCE_PX;

    if (!movedFar) return;

    const isSameTooltip = hoveredHintTooltip?.key === tooltipKey;

    if (hintTooltipTimeoutRef.current) {
      clearPendingHintTooltip();
    }

    if (isSameTooltip) {
      setHoveredHintTooltipPreservingSelection(null);
    }
  };

  const handleClueHintHover = (event, clueIndex) => {
    const highlight = event.target.closest?.("[data-player-highlight-type]");
    if (!highlight || !event.currentTarget.contains(highlight)) {
      hideHintTooltip();
      return;
    }

    const type = highlight.getAttribute("data-player-highlight-type");
    if (!type) {
      hideHintTooltip();
      return;
    }

    const hintText = clues[clueIndex]?.hints?.[type]?.trim();
    if (!hintText) {
      hideHintTooltip();
      return;
    }

    const tooltipKey = `${clueIndex}-${type}`;

    if (hoveredHintTooltip?.key !== tooltipKey && !hintTooltipTimeoutRef.current) {
      scheduleHintTooltip({ ...event, currentTarget: highlight }, tooltipKey, hintText);
      return;
    }

    handleHintTooltipPointerMove(event, tooltipKey);
  };

  const closeHintUi = () => {
    setShowHintMenu(false);
    setOpenHintSection(null);
    setActiveButton(null);
    setHoveredHintTooltip(null);
  };

  const openHintContent = (sectionHeading, itemLabel) => {
    setAssistLog((history) => {
      const nextEntry = { type: "hint", scope: `${sectionHeading}-${itemLabel}` };
      return hasAssistEntry(history, nextEntry) ? history : [...history, nextEntry];
    });

    closeHintUi();
  };

  const revealAllHints = () => {
    setAssistLog((history) => {
      const additions = HINT_SECTIONS.flatMap((section) =>
        section.items.map((itemLabel) => ({ type: "hint", scope: `${section.heading}-${itemLabel}` }))
      ).filter((entry) => !hasAssistEntry(history, entry));

      return additions.length ? [...history, ...additions] : history;
    });

    closeHintUi();
  };

  const handleHintItemClick = (sectionHeading, itemLabel) => {
    if (skipHintConfirm) {
      openHintContent(sectionHeading, itemLabel);
      return;
    }

    setPendingHintTarget({ sectionHeading, itemLabel });
    setShowHintConfirmModal(true);
  };

  const confirmHintOpen = () => {
    if (pendingHintTarget) {
      openHintContent(pendingHintTarget.sectionHeading, pendingHintTarget.itemLabel);
    }
    setShowHintConfirmModal(false);
    setPendingHintTarget(null);
  };

  const cancelHintOpen = () => {
    setShowHintConfirmModal(false);
    setPendingHintTarget(null);
  };

  const beginGame = () => {
    setHasStartedGame(true);
    setShowStartModal(false);
    setShowWelcomeBackModal(false);
    setIsPaused(false);
  };

  const openHowToPlay = () => {
    wasPausedBeforeHowToPlayRef.current = isPaused || !hasStartedGame;
    syncHowToPlayUrl(true);
    setShowHowToPlay(true);
    setShowHintMenu(false);
    setShowRevealMenu(false);
    setShowSettingsMenu(false);
    setShowSettingsPresetMenu(false);
    setOpenHintSection(null);
    setActiveButton("help");
    setHoveredHintTooltip(null);

    if (hasStartedGame && !finishedState) {
      setIsPaused(true);
    }
  };

  const returnToGame = () => {
    syncHowToPlayUrl(false);
    setShowHowToPlay(false);
    setActiveButton(null);

    if (!hasStartedGame && !finishedState) {
      setShowStartModal(true);
      return;
    }

    if (hasStartedGame && !finishedState && !wasPausedBeforeHowToPlayRef.current) {
      setIsPaused(false);
    }
  };

  const resumeGameForPlayerAction = () => {
    setShowWelcomeBackModal(false);
    if (!hasStartedGame) {
      beginGame();
      return;
    }

    if (!finishedState && hasStartedGame && isPaused) {
      setIsPaused(false);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{
        fontFamily: PLAYER_UI_FONT,
        background: theme.appBg,
        color: theme.text,
        visibility:
          mode === "player" && (!sessionHydrated || (!showHowToPlay && !isPlayerLayoutReady))
            ? "hidden"
            : "visible",
      }}
    >
      <div
        ref={shellRef}
        className="mx-auto w-full max-w-[1540px] min-h-screen border"
        style={{ background: theme.shellBg, borderColor: theme.shellBorder }}
      >
        <div style={mode === "player" ? { minHeight: "100vh" } : undefined}>
          <div
            className="relative z-30 border-b px-7 py-1 text-[22px]"
            style={{
              height: `${62 * playerBannerScale}px`,
              minHeight: `${62 * playerBannerScale}px`,
              background: theme.topBarBg,
              borderColor: theme.topBarBorder,
              color: theme.text,
            }}
          >
            {mode === "player" ? (
              <div
                style={{
                  width: `${100 / Math.max(playerBannerScale, 0.001)}%`,
                  transform: `scale(${playerBannerScale})`,
                  transformOrigin: "top left",
                }}
              >
                <div
                  className={`relative z-30 h-[48px] items-center ${isPlayerStackedLayout ? "grid" : "flex justify-between"}`}
                  style={
                    isPlayerStackedLayout
                      ? {
                          gridTemplateColumns: "auto minmax(0, 1fr) auto",
                          columnGap: "clamp(6px, 2vw, 18px)",
                        }
                      : undefined
                  }
                >
                  <div
                    className="relative z-40 flex items-center gap-5 settings-container"
                    style={isPlayerStackedLayout ? { gridColumn: "1", justifySelf: "start" } : undefined}
                  >
                    <button
                      className="flex items-center justify-center w-7 h-7 rounded-lg"
                      type="button"
                      onClick={() => {
                        setShowSettingsMenu((prev) => {
                          const next = !prev;
                          setActiveButton(next ? "settings" : null);
                          setShowSettingsPresetMenu(false);
                          return next;
                        });
                        setShowHintMenu(false);
                        setShowRevealMenu(false);
                        setOpenHintSection(null);
                        setHoveredHintTooltip(null);
                      }}
                      style={{ background: activeButton === "settings" ? theme.controlActiveBg : "transparent" }}
                      aria-label="Settings"
                    >
                      <Settings size={21} strokeWidth={1.5} />
                    </button>
                    {showSettingsMenu && (
                      <div
                        className="absolute left-0 top-[calc(100%+10px)] z-40 w-[220px] overflow-visible rounded-[18px] border shadow-[0_12px_30px_rgba(0,0,0,0.12)]"
                        style={{ background: theme.menuBg, borderColor: theme.menuBorder }}
                      >
                        <button
                          type="button"
                          onClick={() => setIsDarkMode((prev) => !prev)}
                          className="flex w-full items-center justify-between rounded-t-[18px] px-4 py-3 text-left text-[16px]"
                          style={{ color: theme.text }}
                          aria-pressed={isDarkMode}
                        >
                          <span>Dark mode</span>
                          <span
                            className="relative inline-flex h-7 w-12 items-center rounded-full transition-all"
                            style={{
                              background: isDarkMode ? theme.clueActiveBg : theme.controlBorder,
                              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
                            }}
                          >
                            <span
                              className="absolute h-5 w-5 rounded-full transition-all"
                              style={{
                                left: isDarkMode ? "26px" : "2px",
                                background: "#ffffff",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.22)",
                              }}
                            />
                          </span>
                        </button>
                        <div className="mx-4 h-px" style={{ background: theme.menuBorder }} />
                        <button
                          type="button"
                          onClick={() => {
                            setShowSettingsPresetMenu(false);
                            setShowSettingsMenu(false);
                            setActiveButton(null);
                            window.location.href = "mailto:thetryptic@gmail.com";
                          }}
                          className="block w-full cursor-pointer px-4 py-3 text-left text-[16px] transition-colors"
                          style={{ color: theme.text, background: "transparent" }}
                          onMouseEnter={(event) => {
                            event.currentTarget.style.background = theme.menuHoverBg;
                          }}
                          onMouseLeave={(event) => {
                            event.currentTarget.style.background = "transparent";
                          }}
                        >
                          Contact me
                        </button>
                        <>
                          <div className="mx-4 h-px" style={{ background: theme.menuBorder }} />
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowSettingsPresetMenu((prev) => !prev)}
                              className="flex w-full items-center justify-between rounded-b-[18px] px-4 py-3 text-left text-[16px] transition-colors"
                              style={{
                                color: theme.text,
                                background: showSettingsPresetMenu ? theme.menuHoverBg : "transparent",
                              }}
                              onMouseEnter={(event) => {
                                if (!showSettingsPresetMenu) {
                                  event.currentTarget.style.background = theme.menuHoverBg;
                                }
                              }}
                              onMouseLeave={(event) => {
                                if (!showSettingsPresetMenu) {
                                  event.currentTarget.style.background = "transparent";
                                }
                              }}
                            >
                              <span>Load preset (playtest)</span>
                            </button>
                            {showSettingsPresetMenu && (
                              <div
                                className="absolute left-0 top-[calc(100%+8px)] z-50 w-[220px] overflow-hidden rounded-[18px] border shadow-[0_12px_30px_rgba(0,0,0,0.12)]"
                                style={{ background: theme.menuBg, borderColor: theme.menuBorder }}
                              >
                                {availablePresetSlots.map((slot) => (
                                  <button
                                    key={slot.id}
                                    type="button"
                                    onClick={() => handlePresetLoad(slot)}
                                    className="block w-full cursor-pointer px-4 py-3 text-left text-[16px] transition-colors"
                                    style={{ color: theme.text, background: "transparent" }}
                                    onMouseEnter={(event) => {
                                      event.currentTarget.style.background = theme.menuHoverBg;
                                    }}
                                    onMouseLeave={(event) => {
                                      event.currentTarget.style.background = "transparent";
                                    }}
                                  >
                                    {slot.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      </div>
                    )}
                  </div>

                  <div
                    className={isPlayerStackedLayout ? "flex min-w-0 justify-end" : "contents"}
                    style={isPlayerStackedLayout ? { gridColumn: "2" } : undefined}
                  >
                    <div
                      className={isPlayerStackedLayout ? "relative w-full max-w-[920px]" : "contents"}
                    >
                      <div
                        ref={clockGroupRef}
                        className={`${isPlayerStackedLayout ? "relative justify-center" : ""} flex items-center gap-3 font-medium`}
                        style={
                          !isPlayerStackedLayout && playerTimerCenterX !== null
                            ? {
                                position: "absolute",
                                left: `${playerTimerCenterX}px`,
                                top: "50%",
                                transform: "translate(-50%, -50%)",
                              }
                            : undefined
                        }
                      >
                        <span className="text-[16px]">{formatTime(seconds)}</span>
                        <button
                          onClick={() => {
                            if (showHowToPlay) return;
                            if (finishedState) return;
                            if (!hasStartedGame) {
                              beginGame();
                              return;
                            }
                            setIsPaused((p) => !p);
                          }}
                          className="text-[16px] font-medium tracking-tight"
                          style={{ color: finishedState || showHowToPlay ? theme.disabledText : theme.mutedText }}
                          disabled={Boolean(finishedState) || showHowToPlay}
                          type="button"
                        >
                          {isPaused || !hasStartedGame ? <Play size={18} strokeWidth={1.5} /> : <Pause size={18} strokeWidth={1.5} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div
                    ref={playerHeaderActionsRef}
                    className={`relative z-30 items-center text-[16px] font-medium ${isPlayerStackedLayout ? "grid" : "flex gap-8"}`}
                    style={
                      isPlayerStackedLayout
                        ? {
                            gap: "clamp(2px, 1.4vw, 12px)",
                            gridColumn: "3",
                            gridTemplateColumns: "repeat(5, auto)",
                            justifySelf: "end",
                            width: "auto",
                          }
                        : playerHeaderActionsCenterX !== null
                          ? {
                              position: "absolute",
                              left: `${playerHeaderActionsCenterX}px`,
                              top: "50%",
                              transform: "translate(-50%, -50%)",
                            }
                        : undefined
                    }
                  >
                    <div
                      className="flex items-center justify-end gap-[clamp(4px,2vw,32px)]"
                      style={{ display: "contents" }}
                    >
                    <div className="relative hint-container">
                      <button
                        type="button"
                        onClick={() => {
                          if (showHowToPlay) return;
                          resumeGameForPlayerAction();
                          setShowHintMenu((prev) => {
                            const next = !prev;
                            setShowRevealMenu(false);
                            setShowSettingsMenu(false);
                            setOpenHintSection(null);
                            setActiveButton(next ? "hint" : null);
                            if (!next) setHoveredHintTooltip(null);
                            return next;
                          });
                        }}
                        disabled={showHowToPlay}
                        className="px-3 py-1.5 rounded-lg"
                        style={{
                          background: activeButton === "hint" ? theme.controlActiveBg : "transparent",
                          color: showHowToPlay ? theme.disabledText : theme.text,
                        }}
                      >
                        Hint
                      </button>

                      {showHintMenu && (
                        <div
                          className="absolute right-0 top-[calc(100%+10px)] z-40 w-[220px] overflow-hidden rounded-[18px] border shadow-[0_12px_30px_rgba(0,0,0,0.12)]"
                          style={{ background: theme.menuBg, borderColor: theme.menuBorder }}
                        >
                          {isPlayerFinished && (
                            <button
                              type="button"
                              onClick={revealAllHints}
                              className="block w-full cursor-pointer px-4 py-3 text-left text-[16px] font-normal transition-colors"
                              style={{
                                color: theme.text,
                                background: areAllHintsRevealed ? theme.clueActiveBg : unlockedHintHoverBg,
                              }}
                              onMouseEnter={(event) => {
                                event.currentTarget.style.background = areAllHintsRevealed
                                  ? theme.clueActiveBg
                                  : unlockedHintHoverBg;
                              }}
                              onMouseLeave={(event) => {
                                event.currentTarget.style.background = areAllHintsRevealed
                                  ? theme.clueActiveBg
                                  : unlockedHintHoverBg;
                              }}
                            >
                              Hint summary
                            </button>
                          )}
                          {HINT_SECTIONS.map((section) => {
                            const isOpen = openHintSection === section.heading;
                            const revealedHints = revealedHintTypesBySection[section.heading];
                            const areAllHintsUnlocked = section.items.every((item) =>
                              revealedHints?.has(item.toLowerCase())
                            );
                            return (
                              <div key={section.heading}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenHintSection((prev) => (prev === section.heading ? null : section.heading));
                                    setHoveredHintTooltip(null);
                                  }}
                                  className="block w-full cursor-pointer px-4 py-3 text-left text-[16px] font-normal transition-colors"
                                  style={{
                                    color: theme.text,
                                    background: isOpen
                                      ? theme.menuHoverBg
                                      : areAllHintsUnlocked
                                        ? theme.clueInactiveBg
                                        : "transparent",
                                  }}
                                  onMouseEnter={(event) => {
                                    event.currentTarget.style.background = areAllHintsUnlocked
                                      ? unlockedHintHoverBg
                                      : theme.menuHoverBg;
                                  }}
                                  onMouseLeave={(event) => {
                                    event.currentTarget.style.background = areAllHintsUnlocked
                                      ? theme.clueInactiveBg
                                      : "transparent";
                                  }}
                                >
                                  {section.heading}
                                </button>
                                {isOpen && (
                                  <div>
                                    {section.items.map((item) => {
                                      const normalizedItem = item.toLowerCase();
                                      const isUnlocked = Boolean(
                                        revealedHintTypesBySection[section.heading]?.has(normalizedItem)
                                      );

                                      return (
                                        <div key={`${section.heading}-${item}`} className="relative">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (isUnlocked) return;
                                              handleHintItemClick(section.heading, item);
                                            }}
                                            className="flex w-full cursor-pointer items-center justify-between px-6 py-3 text-left text-[16px] font-normal transition-colors"
                                            style={{
                                              color: theme.text,
                                              background: isUnlocked ? theme.clueInactiveBg : "transparent",
                                            }}
                                            onMouseEnter={(event) => {
                                              event.currentTarget.style.background = isUnlocked
                                                ? unlockedHintHoverBg
                                                : theme.menuHoverBg;
                                            }}
                                            onMouseLeave={(event) => {
                                              event.currentTarget.style.background = isUnlocked
                                                ? theme.clueInactiveBg
                                                : "transparent";
                                            }}
                                          >
                                            <span>{item}</span>
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      ref={clearButtonRef}
                      onClick={() => {
                        if (showHowToPlay) return;
                        if (isPlayerFinished) return;
                        resumeGameForPlayerAction();
                        setActiveButton("clear");
                        clearPuzzle();
                      }}
                      type="button"
                      disabled={isPlayerFinished || showHowToPlay}
                      className="px-3 py-1.5 rounded-lg"
                      style={{
                        background: activeButton === "clear" ? theme.controlActiveBg : "transparent",
                        color: isPlayerFinished || showHowToPlay ? theme.disabledText : theme.text,
                      }}
                    >
                      Clear
                    </button>
                    </div>

                    <div className="relative reveal-container">
                      <button
                        onClick={() => {
                          if (showHowToPlay) return;
                          if (isPlayerFinished) return;
                          resumeGameForPlayerAction();
                          setShowRevealMenu((prev) => {
                            const next = !prev;
                            setShowHintMenu(false);
                            setShowSettingsMenu(false);
                            setActiveButton(next ? "reveal" : null);
                            return next;
                          });
                        }}
                        type="button"
                        disabled={isPlayerFinished || showHowToPlay}
                        className="px-3 py-1.5 rounded-lg"
                        style={{
                          background: activeButton === "reveal" ? theme.controlActiveBg : "transparent",
                          color: isPlayerFinished || showHowToPlay ? theme.disabledText : theme.text,
                        }}
                      >
                        Reveal
                      </button>

                      {showRevealMenu && (
                        <div
                          className="absolute right-0 top-[calc(100%+10px)] z-40 w-[220px] overflow-hidden rounded-[18px] border shadow-[0_12px_30px_rgba(0,0,0,0.12)]"
                          style={{ background: theme.menuBg, borderColor: theme.menuBorder }}
                        >
                          {[
                            { label: "Square", action: "square" },
                            { label: "Left", action: "left" },
                            { label: "Right", action: "right" },
                            { label: "Base", action: "base" },
                            { label: "Puzzle (+hint summary)", action: "puzzle-with-hint-summary" },
                          ].map((item) => (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => requestRevealAction(item.action)}
                              className="block w-full cursor-pointer px-4 py-3 text-left text-[16px] font-normal transition-colors"
                              style={{ color: theme.text, background: "transparent" }}
                              onMouseEnter={(event) => {
                                event.currentTarget.style.background = theme.menuHoverBg;
                              }}
                              onMouseLeave={(event) => {
                                event.currentTarget.style.background = "transparent";
                              }}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div
                      className="flex items-center justify-start gap-[clamp(4px,2vw,32px)]"
                      style={{ display: "contents" }}
                    >
                    <button
                      className="flex items-center justify-center rounded-lg px-2 py-1.5"
                      type="button"
                      onClick={showHowToPlay ? returnToGame : openHowToPlay}
                      aria-label="How to play"
                      style={{ background: activeButton === "help" ? theme.controlActiveBg : "transparent" }}
                    >
                      <HelpCircle size={21} strokeWidth={1.5} />
                    </button>

                    {isLocalEditorEnabled && !hidePlayerModeToggle ? (
                      <div
                        className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full border px-1.5"
                        style={{ borderColor: theme.controlBorder, background: theme.controlGroupBg }}
                      >
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-full"
                          type="button"
                          onClick={enterPlayerMode}
                          aria-label="Player mode"
                          style={{
                            background: mode === "player" ? theme.text : "transparent",
                            color: mode === "player" ? theme.shellBg : theme.mutedText,
                          }}
                        >
                          <Gamepad2 size={18} strokeWidth={1.8} />
                        </button>
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-full"
                          type="button"
                          onClick={enterEditorMode}
                          aria-label="Editor mode"
                          style={{
                            background: mode === "editor" ? theme.text : "transparent",
                            color: mode === "editor" ? theme.shellBg : theme.mutedText,
                          }}
                        >
                          <Pencil size={18} strokeWidth={1.8} />
                        </button>
                      </div>
                    ) : !isLocalEditorEnabled ? (
                      <ModeToggleSpacer theme={theme} />
                    ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  width: `${100 / Math.max(playerBannerScale, 0.001)}%`,
                  transform: `scale(${playerBannerScale})`,
                  transformOrigin: "top left",
                }}
              >
                <div className="h-[48px] flex items-center justify-between gap-6">
                  <div className="flex items-center gap-3 min-w-0 flex-wrap">
                    <span
                      className="text-[15px] font-semibold shrink-0"
                      style={{ color: isEditorContentLocked ? "rgba(0,0,0,0.38)" : undefined }}
                    >
                      Palette
                    </span>
                    {PALETTE_ITEMS.map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        onMouseDown={(event) => startDraggingPalette(event, item.type)}
                        disabled={isEditorContentLocked}
                        className="flex items-center gap-2 rounded-full border border-[#d8d8d8] px-3 py-2 text-[14px] font-medium bg-[#fafafa] disabled:opacity-45"
                      >
                        <span
                          className="inline-block h-4 w-4 rounded-sm border border-black"
                          style={{ background: item.color }}
                        />
                        {item.label}
                      </button>
                    ))}

                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <input
                        ref={loadPuzzleInputRef}
                        type="file"
                        accept=".try,application/x-tryptic-puzzle+json"
                        onChange={handleLoadPuzzle}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={handleSavePuzzle}
                        disabled={isLoadingPuzzle || isEditorContentLocked}
                        className="flex items-center gap-2 rounded-full border border-[#d8d8d8] bg-white px-3 py-2 text-[14px] font-medium disabled:opacity-60"
                      >
                        <Save size={15} strokeWidth={1.8} />
                        Save .try
                      </button>

                      <button
                        type="button"
                        onClick={handleLoadPuzzleClick}
                        disabled={isLoadingPuzzle || isEditorContentLocked}
                        className="flex items-center gap-2 rounded-full border border-[#d8d8d8] bg-white px-3 py-2 text-[14px] font-medium disabled:opacity-60"
                      >
                        <FolderOpen size={15} strokeWidth={1.8} />
                        {isLoadingPuzzle ? "Loading..." : "Load .try"}
                      </button>

                      <div className="relative preset-container">
                        <button
                          type="button"
                          onClick={() => {
                            setShowDebutMenu(false);
                            setShowPresetMenu((prev) => !prev);
                          }}
                          disabled={isSettingPreset || !isAuthoringEnabled}
                          className="flex items-center gap-2 rounded-full border border-[#d8d8d8] bg-white px-3 py-2 text-[14px] font-medium disabled:opacity-60"
                        >
                          <Triangle size={15} strokeWidth={1.8} />
                          Set Preset
                        </button>

                        {showPresetMenu && (
                          <div
                            className="absolute left-0 top-[calc(100%+8px)] z-50 w-[310px] overflow-hidden rounded-[16px] border border-[#d8d8d8] bg-white shadow-[0_12px_30px_rgba(0,0,0,0.12)]"
                          >
                            {PUZZLE_PRESET_SLOTS.map((slot) => {
                              const preset = puzzlePresets[slot.id];
                              return (
                                <button
                                  key={slot.id}
                                  type="button"
                                  onClick={() => handlePresetSet(slot)}
                                  className="flex w-full cursor-pointer items-baseline gap-2 px-4 py-3 text-left text-[14px] transition-colors hover:bg-[#f3f3f3]"
                                >
                                  <span className="shrink-0 font-medium text-[#111111]">
                                    {slot.label}
                                  </span>
                                  {preset?.fileName ? (
                                    <span className="min-w-0 truncate text-[12px] text-black/40">{preset.fileName}</span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="relative debut-container">
                        <button
                          type="button"
                          onClick={() => {
                            setShowPresetMenu(false);
                            setShowDebutMenu((prev) => !prev);
                          }}
                          disabled={!isAuthoringEnabled}
                          className="flex items-center gap-2 rounded-full border border-[#d8d8d8] bg-white px-3 py-2 text-[14px] font-medium disabled:opacity-60"
                        >
                          <Send size={15} strokeWidth={1.8} />
                          Debut
                        </button>

                        {showDebutMenu && (
                          <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[380px] overflow-hidden rounded-[18px] border border-[#d8d8d8] bg-white shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
                            <div className="border-b border-[#e5e5e5] px-4 py-3">
                              <div className="text-[15px] font-semibold text-[#111111]">Triangle Debut</div>
                              <div className="mt-1 text-[12px] leading-5 text-black/55">
                                Debuts run for 48 hours max. The public default uses the active debut first, then Triangle 1.
                              </div>
                              {activeTriangleDebut ? (
                                <div className="mt-2 rounded-[12px] bg-[#f3f7f4] px-3 py-2 text-[12px] text-[#234536]">
                                  Now live: <span className="font-semibold">{getDebutDisplayName(activeTriangleDebut)}</span> until{" "}
                                  {formatDebutDateTimeLabel(activeTriangleDebut.endsAt)}.
                                </div>
                              ) : null}
                            </div>

                            <div className="border-b border-[#e5e5e5] px-4 py-4">
                              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-black/45">
                                1. Schedule
                              </div>
                              <div className="mt-3">
                                <button
                                  type="button"
                                  onClick={handleSelectDebutFile}
                                  className="flex w-full items-center justify-between rounded-[12px] border border-[#d8d8d8] px-3 py-2 text-left text-[14px] font-medium text-[#111111]"
                                >
                                  <span className="min-w-0 flex-1 truncate pr-3">
                                    {selectedDebutFileName || "Choose .try file"}
                                  </span>
                                  <FolderOpen size={15} strokeWidth={1.8} />
                                </button>
                                <div className="mt-1 text-[12px] leading-5 text-black/55">
                                  Only `.try` files are accepted.
                                </div>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-3">
                                <label className="flex flex-col gap-1 text-[13px] font-medium text-[#111111]">
                                  Debut day
                                  <input
                                    type="date"
                                    value={debutDateInput}
                                    onChange={(event) => setDebutDateInput(event.target.value)}
                                    className="rounded-[12px] border border-[#d8d8d8] px-3 py-2 text-[14px] font-normal outline-none"
                                  />
                                </label>
                                <label className="flex flex-col gap-1 text-[13px] font-medium text-[#111111]">
                                  Debut time
                                  <input
                                    type="time"
                                    value={debutTimeInput}
                                    onChange={(event) => setDebutTimeInput(event.target.value)}
                                    className="rounded-[12px] border border-[#d8d8d8] px-3 py-2 text-[14px] font-normal outline-none"
                                  />
                                </label>
                              </div>
                              <div className="mt-3 text-[12px] leading-5 text-black/55">
                                Default debut time is 6:00 AM. This puzzle stays default until{" "}
                                {(() => {
                                  const previewStart = buildLocalDateFromInputs(debutDateInput, debutTimeInput);
                                  if (!previewStart) return "the next day at the same time";
                                  return formatDebutDateTimeLabel(
                                    new Date(previewStart.getTime() + MAX_TRIANGLE_DEBUT_DURATION_MS).toISOString()
                                  );
                                })()}
                                .
                              </div>
                              <div className="mt-4 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={handleSaveTriangleDebut}
                                  className="rounded-full bg-[#111111] px-4 py-2 text-[13px] font-medium text-white"
                                >
                                  {selectedTriangleDebut ? "Save debut changes" : "Schedule debut"}
                                </button>
                                {selectedTriangleDebut ? (
                                  <button
                                    type="button"
                                    onClick={handleDeleteTriangleDebut}
                                    className="rounded-full border border-[#d8d8d8] px-4 py-2 text-[13px] font-medium text-[#111111]"
                                  >
                                    Delete debut
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={resetDebutForm}
                                  className="rounded-full border border-[#d8d8d8] px-4 py-2 text-[13px] font-medium text-[#111111]"
                                >
                                  New
                                </button>
                              </div>
                            </div>

                            <div className="px-4 py-4">
                              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-black/45">
                                2. Scheduled triangles
                              </div>
                              <div className="mt-3 max-h-[260px] overflow-auto">
                                {scheduledTriangleDebuts.length ? (
                                  <div className="space-y-2">
                                    {scheduledTriangleDebuts.map((entry) => {
                                      const isActive =
                                        new Date(entry.startsAt).getTime() <= Date.now() &&
                                        Date.now() < new Date(entry.endsAt).getTime();
                                      const isSelected = entry.id === selectedDebutId;
                                      const borderColor = isActive
                                        ? isSelected
                                          ? "#15803d"
                                          : "#86efac"
                                        : isSelected
                                          ? "#111111"
                                          : "#d8d8d8";
                                      const backgroundColor = isActive
                                        ? isSelected
                                          ? "#dcfce7"
                                          : "#f0fdf4"
                                        : isSelected
                                          ? "#f7f7f7"
                                          : "#ffffff";
                                      const badgeColor = isActive ? "#15803d" : "rgba(0,0,0,0.45)";
                                      return (
                                        <button
                                          key={entry.id}
                                          type="button"
                                          onClick={() => handleDebutItemSelect(entry)}
                                          className="block w-full rounded-[14px] border px-3 py-3 text-left transition-colors"
                                          style={{
                                            borderColor,
                                            background: backgroundColor,
                                          }}
                                        >
                                          <div className="flex items-center justify-between gap-3 text-[13px] font-semibold text-[#111111]">
                                            <span className="truncate">{getDebutDisplayName(entry)}</span>
                                            <span
                                              className="shrink-0 text-[11px] uppercase tracking-[0.08em]"
                                              style={{ color: badgeColor }}
                                            >
                                              {isActive ? "Live" : "Scheduled"}
                                            </span>
                                          </div>
                                          <div className="mt-1 text-[12px] leading-5 text-black/55">
                                            {formatDebutDateTimeLabel(entry.startsAt)} to {formatDebutDateTimeLabel(entry.endsAt)}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="rounded-[14px] border border-dashed border-[#d8d8d8] px-3 py-4 text-[12px] text-black/55">
                                    No triangle debuts scheduled yet.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {puzzleActionStatus && (
                        <div className="max-w-[220px] truncate rounded-full bg-black/[0.04] px-3 py-1 text-[12px] text-black/60 whitespace-nowrap">
                          {puzzleActionStatus}
                        </div>
                      )}
                      {isLocalEditorEnabled && authoringAuth.checked ? (
                        authoringAuth.authenticated ? (
                          <button
                            type="button"
                            onClick={handleAuthoringLogout}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#9fd3ad] bg-[#e7f7eb] px-3 py-1 text-[12px] font-medium text-[#1e7a37]"
                            disabled={isAuthoringAuthBusy}
                          >
                            <LockOpen size={13} strokeWidth={2} />
                            {isAuthoringAuthBusy ? "Locking..." : "Publishing unlocked"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={promptForAuthoringLogin}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#e0a6a6] bg-[#fff0f0] px-3 py-1 text-[12px] font-medium text-[#b42318]"
                            disabled={isAuthoringAuthBusy}
                          >
                            <Lock size={13} strokeWidth={2} />
                            {isAuthoringAuthBusy ? "Unlocking..." : "Publishing locked"}
                          </button>
                        )
                      ) : null}
                      <div className="max-w-[220px] truncate text-[12px] text-black/50 whitespace-nowrap">
                        {defaultSourceLabel}
                      </div>
                    </div>
                  </div>

                  {isLocalEditorEnabled ? (
                    <div
                      className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full border px-1.5"
                      style={{ borderColor: theme.controlBorder, background: theme.controlGroupBg }}
                    >
                      <button
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${mode === "player" ? "bg-[#111] text-white" : "text-black/65"}`}
                        type="button"
                        onClick={enterPlayerMode}
                        aria-label="Player mode"
                      >
                        <Gamepad2 size={18} strokeWidth={1.8} />
                      </button>
                      <button
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${mode === "editor" ? "bg-[#111] text-white" : "text-black/65"}`}
                        type="button"
                        onClick={enterEditorMode}
                        aria-label="Editor mode"
                      >
                        <Pencil size={18} strokeWidth={1.8} />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {mode === "player" && showHowToPlay ? (
            <div
              className="relative min-h-[calc(100vh-62px)] overflow-hidden px-6 pb-20 pt-8"
              style={{
                background: howToPlayTheme.pageBg,
                color: howToPlayTheme.text,
                "--tryptic-strong-text": howToPlayTheme.strongText,
              }}
            >
              <button
                type="button"
                onClick={returnToGame}
                className="fixed z-40 rounded-full px-5 py-3 text-[15px] font-semibold shadow-[0_12px_26px_rgba(15,31,26,0.14)] outline-none transition-transform hover:scale-[1.02]"
                style={{
                  top: `${62 * playerBannerScale + 18}px`,
                  right: "max(24px, calc((100vw - 1540px) / 2 + 24px))",
                  background: theme.clueActiveBg,
                  color: usePlayerAppearanceTheme ? "#ffffff" : "#07140f",
                }}
              >
                Return to game
              </button>

              <div className="mx-auto max-w-[980px] pt-24">
                <div className="grid gap-6">
                  {HOW_TO_PLAY_SECTIONS.map((section) => (
                    <section
                      key={section.heading}
                      className="rounded-[28px] border p-7"
                      style={{
                        background: howToPlayTheme.cardBg,
                        borderColor: howToPlayTheme.border,
                        boxShadow: howToPlayTheme.shadow,
                      }}
                    >
                      <div className="mb-5">
                        <h2 className="text-[clamp(28px,4vw,44px)] font-semibold leading-none tracking-[-0.06em]">
                          {section.heading}
                          {section.parenthetical ? (
                            <span className="ml-2 text-[0.62em] tracking-[-0.04em]">
                              ({section.parenthetical})
                            </span>
                          ) : null}
                        </h2>
                      </div>
                      {section.heading === "How to Traverse the Triangle" && (
                        <>
                          <div
                            className="mb-7 rounded-[22px] p-5 text-[18px] leading-8"
                            style={{ background: howToPlayTheme.nestedBg, color: howToPlayTheme.bodyText }}
                          >
                            <h3 className="mb-4 font-bold" style={{ color: howToPlayTheme.strongText }}>
                              Triangle basics:
                            </h3>
                            <div className="grid items-center gap-5 md:grid-cols-[minmax(150px,220px)_minmax(220px,1fr)_minmax(150px,220px)]">
                              <div className="flex justify-center">
                                <MiniTrianglePreview
                                  squares={TRAVERSAL_LEFT_TEMPLATE_SQUARES}
                                  ariaLabel="Blank 5 5 5 Tryptic triangle"
                                  theme={theme}
                                  highlightedSide="base"
                                />
                              </div>
                              <p
                                className="text-center text-[19px] font-normal leading-7 tracking-[-0.03em]"
                                style={{ color: howToPlayTheme.bodyText }}
                              >
                                Triangles always have a{" "}
                                <span className="font-semibold" style={{ color: howToPlayTheme.strongText }}>
                                  left
                                </span>
                                ,{" "}
                                <span className="font-semibold" style={{ color: howToPlayTheme.strongText }}>
                                  right
                                </span>
                                , and{" "}
                                <span className="font-semibold" style={{ color: howToPlayTheme.strongText }}>
                                  base
                                </span>{" "}
                                side
                                <br />
                                <br />
                                Triangle sides always{" "}
                                <span className="font-semibold" style={{ color: howToPlayTheme.strongText }}>
                                  read left to right
                                </span>
                                , or{" "}
                                <span className="font-semibold" style={{ color: howToPlayTheme.strongText }}>
                                  top to bottom
                                </span>{" "}
                                if vertical
                              </p>
                              <div className="flex justify-center">
                                <MiniTrianglePreview
                                  squares={TRAVERSAL_RIGHT_TEMPLATE_SQUARES}
                                  ariaLabel="Blank 6 6 4 right Tryptic triangle"
                                  theme={theme}
                                  highlightedSide="left"
                                />
                              </div>
                            </div>
                          </div>

                          <div
                            className="mb-7 grid items-center gap-5 rounded-[22px] border-[8px] p-5 text-[18px] leading-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
                            style={{
                              background: howToPlayTheme.nestedBg,
                              borderColor: howToPlayTheme.accentBorder,
                              color: howToPlayTheme.bodyText,
                            }}
                          >
                            <div className="min-w-0">
                              <h3 className="mb-3 font-bold" style={{ color: howToPlayTheme.strongText }}>
                                Moving around the triangle:
                              </h3>
                              <ol className="list-decimal space-y-2 pl-6">
                                <li>Arrow keys</li>
                                <li>Typing</li>
                                <li>Click on any square</li>
                                <li>Click on any clue box (this will send you to a side&apos;s starting corner)</li>
                              </ol>
                              <div
                                className="mt-4 flex items-center gap-2 pl-6 font-semibold"
                                style={{ color: howToPlayTheme.strongText }}
                              >
                                <span>Try it!</span>
                                <span className="flex items-center gap-0">
                                  <ArrowRight size={20} strokeWidth={2} />
                                  <ArrowRight size={20} strokeWidth={2} />
                                  <ArrowRight size={20} strokeWidth={2} />
                                </span>
                              </div>
                            </div>
                            <div className="flex min-w-0 justify-center">
                              <InteractiveMiniTriangle
                                squares={TRAVERSAL_INTERACTIVE_TEMPLATE_SQUARES}
                                theme={theme}
                              />
                            </div>
                          </div>

                          <div
                            className="mb-7 grid min-h-[300px] items-start gap-5 rounded-[22px] border-[8px] p-5 text-[18px] leading-8 md:grid-cols-[minmax(0,1fr)_minmax(260px,380px)]"
                            style={{
                              background: howToPlayTheme.nestedBg,
                              borderColor: howToPlayTheme.accentBorder,
                              color: howToPlayTheme.bodyText,
                            }}
                          >
                            <div className="min-w-0">
                              <h3 className="mb-3 font-bold" style={{ color: howToPlayTheme.strongText }}>
                                Clue boxes:
                              </h3>
                              <p className="leading-7">
                                Revealing hints highlights wordplay in white, highlights fodder in
                                green, and underlines definitions inside clue boxes.
                              </p>
                              <p className="mt-4 leading-7">
                                <span className="font-semibold" style={{ color: howToPlayTheme.strongText }}>
                                  Hovering
                                </span>{" "}
                                over highlighted/ underlined clue text shows additional hint information.
                              </p>
                              <div
                                className="mt-4 flex items-center gap-2 font-semibold"
                                style={{ color: howToPlayTheme.strongText }}
                              >
                                <span>Try it!</span>
                                <span className="flex items-center gap-0">
                                  <ArrowRight size={20} strokeWidth={2} />
                                  <ArrowRight size={20} strokeWidth={2} />
                                  <ArrowRight size={20} strokeWidth={2} />
                                </span>
                              </div>
                            </div>
                            <div className="flex min-w-0 justify-center pt-[48px]">
                              <MiniClueBoxExample
                                theme={theme}
                                fontFamily={PLAYER_UI_FONT}
                                fixedFontSize={sharedPlayerClueFontSize}
                                highlightStyles={playerClueHighlightStyles}
                              />
                            </div>
                          </div>

                          <div
                            className="mb-7 rounded-[22px] p-5 text-[18px] leading-7"
                            style={{ background: howToPlayTheme.nestedBg, color: howToPlayTheme.bodyText }}
                          >
                            <h3 className="mb-4 font-bold" style={{ color: howToPlayTheme.strongText }}>
                              Banner buttons:
                            </h3>
                            <div className="grid gap-x-4 gap-y-2 md:grid-cols-2">
                              <p><span className="font-semibold" style={{ color: howToPlayTheme.strongText }}>Pause/Play</span> starts, pauses, or resumes the game timer.</p>
                              <p><span className="font-semibold" style={{ color: howToPlayTheme.strongText }}>Hint</span> reveals wordplay, fodder, or definition help for a clue.</p>
                              <p><span className="font-semibold" style={{ color: howToPlayTheme.strongText }}>Clear</span> wipes your current entries so you can restart the puzzle.</p>
                              <p><span className="font-semibold" style={{ color: howToPlayTheme.strongText }}>Reveal</span> can show a square, a side, or the whole puzzle when you are stuck.</p>
                            </div>
                          </div>
                        </>
                      )}
                      {section.items.length > 0 && (
                        <div
                          className="grid gap-3 text-[17px] leading-7 md:grid-cols-2"
                          style={{ color: howToPlayTheme.bodyText }}
                        >
                          {section.items.map((item) => (
                            <p key={item}>{item}</p>
                          ))}
                        </div>
                      )}
                      {section.heading === "How to Triumph the Tryptic" && (
                        <div className="mt-7 grid gap-4">
                          <div className="flex items-center justify-center gap-4">
                            <img
                              src={trypticLogo}
                              alt="The Tryptic logo"
                              className="w-[96px] h-auto shrink-0"
                            />
                            <div
                              className="inline-flex rounded-[22px] px-7 py-5 text-[22px] leading-8"
                              style={{
                                background: howToPlayTheme.accentBg,
                                color: usePlayerAppearanceTheme ? "#ffffff" : "rgba(0,0,0,0.78)",
                              }}
                            >
                              <p>The Tryptic is a triangular cryptic-style tri-weekly puzzle game.</p>
                            </div>
                          </div>
                          {TRIUMPH_SUBSECTIONS.map((subsection) => (
                            <div
                              key={subsection}
                              className={`rounded-[22px] p-5 text-[18px] leading-7 ${
                                subsection === "Types of wordplay" ? "border-[8px]" : "border"
                              }`}
                              style={{
                                background: howToPlayTheme.nestedBg,
                                borderColor:
                                  subsection === "Types of wordplay"
                                    ? howToPlayTheme.accentBg
                                    : howToPlayTheme.border,
                                color: howToPlayTheme.bodyText,
                              }}
                            >
                              <h3 className="font-bold" style={{ color: howToPlayTheme.strongText }}>
                                {subsection}:
                              </h3>
                              {TRIUMPH_SUBSECTION_BODY[subsection] ? (
                                <div className="mt-4">
                                  {Array.isArray(TRIUMPH_SUBSECTION_BODY[subsection])
                                    ? subsection === "Types of wordplay"
                                      ? (
                                        <>
                                          <p>
                                            There is often multiple wordplay in a clue (and sometimes one piece of
                                            wordplay is doing multiple things), but here is a list of some basics.
                                          </p>
                                          <div
                                            className="mt-4 rounded-[20px] p-5"
                                            style={{
                                              background: howToPlayTheme.softAccentBg,
                                              color: usePlayerAppearanceTheme
                                                ? "rgba(248,250,252,0.86)"
                                                : howToPlayTheme.bodyText,
                                            }}
                                          >
                                            <div className="grid gap-x-7 gap-y-5 md:grid-cols-3">
                                              {TRIUMPH_SUBSECTION_BODY[subsection].map((line) => (
                                                <p key={line} className="leading-6">
                                                  {renderWordplayExplanation(line)}
                                                </p>
                                              ))}
                                            </div>
                                            <p
                                              className="mt-5 border-t pt-4 text-[16px] italic leading-6"
                                              style={{ borderColor: usePlayerAppearanceTheme ? "#3b6470" : "#9acdbc" }}
                                            >
                                              <span className="font-semibold">Substitution:</span> fodder will
                                              sometimes need to be replaced by a single letter, multiletter, or word
                                              equivalent (e.g. roman numerals, NATO alphabet, periodic table, pop
                                              culture references, regular synonyms, etc...)
                                            </p>
                                          </div>
                                          <p className="mt-4">
                                            Cryptic wordplay can have a learning curve. Consult the{" "}
                                            <span className="font-semibold" style={{ color: howToPlayTheme.strongText }}>
                                              hint summary
                                            </span>{" "}
                                            after
                                            solving/revealing the puzzle if you&apos;re feeling lost.
                                          </p>
                                        </>
                                      )
                                      : subsection === "Clues"
                                        ? (
                                            <>
                                              {TRIUMPH_SUBSECTION_BODY[subsection].map((line) =>
                                                line.includes("\n") ? (
                                                  <Fragment key={line}>
                                                    <ol className="mt-3 list-decimal space-y-2 pl-6">
                                                      {line.split("\n").map((item) => (
                                                        <li key={item}>{renderCluePartsExplanation(item)}</li>
                                                      ))}
                                                    </ol>
                                                    <p className="mt-3 text-[15px] italic leading-6">
                                                      {CLUE_DEFINITION_NOTE}
                                                    </p>
                                                  </Fragment>
                                                ) : (
                                                  <p key={line} className="mt-3 first:mt-0">
                                                    {renderCluePartsExplanation(line)}
                                                  </p>
                                                )
                                              )}
                                            </>
                                          )
                                      : subsection === "Scoring"
                                        ? TRIUMPH_SUBSECTION_BODY[subsection].map((line) => (
                                            <p key={line} className="mt-3 first:mt-0">
                                              {renderScoringExplanation(line)}
                                            </p>
                                          ))
                                      : TRIUMPH_SUBSECTION_BODY[subsection].map((line) => (
                                          <p key={line} className="mt-3 first:mt-0">
                                            {line}
                                          </p>
                                        ))
                                    : TRIUMPH_SUBSECTION_BODY[subsection]}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              </div>
            </div>
          ) : (
          <div className="relative">
            {mode === "player" && hasStartedGame && isPaused && !finishedState ? (
              <button
                type="button"
                aria-label="Resume game"
                onClick={resumeGameForPlayerAction}
                className="absolute inset-0 z-10 cursor-pointer"
                style={{ background: "transparent" }}
              />
            ) : null}

            <div
              className={`${mode === "editor" ? "flex flex-col" : isPlayerStackedLayout ? "grid grid-cols-1" : "grid grid-cols-[minmax(0,1fr)_minmax(420px,520px)]"} min-h-[calc(100vh-62px)] gap-8`}
              aria-hidden={isEditorContentLocked ? "true" : undefined}
              inert={isEditorContentLocked ? true : undefined}
              style={{
                filter: shouldBlurPlayerContent || isEditorContentLocked ? "blur(8px)" : "none",
                transition: "filter 180ms ease",
                pointerEvents: isEditorContentLocked ? "none" : "auto",
                userSelect: isEditorContentLocked ? "none" : undefined,
                gridTemplateColumns:
                  mode === "player" && !isPlayerStackedLayout
                    ? `${playerHorizontalTracks.boardColumn}px ${playerHorizontalTracks.clueColumn}px`
                    : undefined,
                columnGap:
                  mode === "player"
                    ? `${isPlayerStackedLayout ? PLAYER_BOARD_CLUE_GAP : playerHorizontalTracks.gap}px`
                    : undefined,
                rowGap: mode === "player" ? (isPlayerStackedLayout ? "0px" : undefined) : undefined,
                alignContent: mode === "player" && isPlayerStackedLayout ? "start" : undefined,
              }}
            >
              <div
                ref={boardPaneRef}
                className={`relative ${mode === "editor" ? "h-[calc((100vh-62px)*0.7)] flex-none overflow-hidden px-5 py-6" : isPlayerStackedLayout ? "overflow-hidden px-5 py-0" : "flex-1 overflow-hidden px-0 py-6"}`}
              >
                <div
                  ref={boardShellRef}
                  className={`relative w-full ${mode === "editor" ? "max-w-none h-full" : "max-w-[920px]"}`}
                  style={
                    mode === "editor"
                      ? undefined
                      : isPlayerStackedLayout
                        ? {
                            height: `${playerStackedBoardShellHeight}px`,
                            maxWidth: "560px",
                            margin: "0 auto",
                          }
                        : {
                            aspectRatio: `${BOARD_WIDTH} / ${BOARD_HEIGHT}`,
                          }
                  }
                >
                  <div
                    ref={boardRef}
                    onMouseDown={handleBoardMouseDown}
                    className={`relative rounded-[28px] ${mode === "editor" ? "border" : "border border-transparent"}`}
                    style={{
                      background: mode === "editor" ? theme.boardBg : theme.playerBoardBg,
                      borderColor: mode === "editor" ? theme.boardBorder : "transparent",
                      width: `${mode === "editor" ? editorBoardSize.width : BOARD_WIDTH}px`,
                      height: `${mode === "editor" ? editorBoardSize.height : BOARD_HEIGHT}px`,
                      position: "absolute",
                      left: 0,
                      top: 0,
                      transform: `translate(${snapToDevicePixel(boardOffsetX)}px, ${snapToDevicePixel(boardOffsetY)}px) scale(${renderedBoardScale})`,
                      transformOrigin: "top left",
                      touchAction: "none",
                      willChange: "transform",
                      backfaceVisibility: "hidden",
                    }}
                  >
                    {mode === "editor" && <BoardGrid width={editorBoardSize.width} height={editorBoardSize.height} />}

              {visibleSquares.map((square) => {
                const role = boardData.squareRoleById?.[square.id] || null;
                const dataRole = role?.kind === "side" ? role.side : role?.corner || square.type;
                return (
                  <div
                    key={square.id}
                    data-square="true"
                    data-side={dataRole}
                    ref={(el) => {
                      squareRefs.current[square.id] = el;
                    }}
                    style={cellStyle(square)}
                    onMouseDown={(event) => startDraggingExisting(event, square)}
                    onDoubleClick={() => {
                      setSelectedId(square.id);
                      setTypingFlow(true);
                    }}
                    title={mode === "editor" ? boardData.squareLabelById?.[square.id] || SIDE_LABELS[square.type] || square.type : undefined}
                  >
                    <TileOutline color={theme.tileOutline} />

                    {mode === "editor" && isCornerType(square.type) && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: 6,
                          left: 8,
                          fontSize: "17px",
                          color: "#cf2f2f",
                          fontWeight: 700,
                          opacity: 0.7,
                          pointerEvents: "none",
                        }}
                      >
                        {square.type === "topCorner"
                          ? "T"
                          : square.type === "bottomLeftCorner"
                          ? "L"
                          : square.type === "bottomRightCorner"
                          ? "R"
                          : ""}
                      </div>
                    )}

                    <input
                      ref={(el) => {
                        inputRefs.current[square.id] = el;
                      }}
                      value={mode === "editor" ? square.letter : playerLetters[square.id] || ""}
                      onChange={(e) => handleSquareInputChange(square.id, e.target.value)}
                      onFocus={() => {
                        if (mode === "player") {
                          handlePlayerSquareActivate(square.id);
                          return;
                        }
                        setSelectedId(square.id);
                      }}
                      onClick={() => {
                        if (mode === "player") {
                          handlePlayerSquareActivate(square.id);
                          return;
                        }
                        setSelectedId(square.id);
                        setTypingFlow(false);
                      }}
                      onKeyDown={(e) => handleSquareKeyDown(e, square)}
                      maxLength={1}
                      className="w-full h-full bg-transparent text-center outline-none"
                      style={{
                        position: "relative",
                        zIndex: 1,
                        fontSize: "56px",
                        fontWeight: 600,
                        fontFamily: PLAYER_UI_FONT,
                        color: theme.tileText,
                        textTransform: "uppercase",
                        caretColor: mode === "editor" ? "auto" : "transparent",
                        border: "none",
                        pointerEvents: mode === "editor" || (mode === "player" && (finishedState || isPlayerInputLocked)) ? "none" : "auto",
                      }}
                      aria-label={`Square ${square.id}`}
                      readOnly={Boolean(dragState?.id === square.id) || (mode === "player" && Boolean(finishedState))}
                      disabled={mode === "player" && isPlayerInputLocked}
                      tabIndex={mode === "player" && isPlayerInputLocked ? -1 : undefined}
                    />
                  </div>
                );
              })}

              {selectionBox && (
                <div
                  style={{
                    position: "absolute",
                    left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
                    top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
                    width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}px`,
                    height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}px`,
                    border: "3px dashed rgba(59,130,246,0.95)",
                    background: "rgba(59,130,246,0.14)",
                    boxShadow: "0 0 0 9999px rgba(59,130,246,0.05)",
                    borderRadius: "14px",
                    pointerEvents: "none",
                    zIndex: 6,
                  }}
                />
              )}

              {dragState && (
                <>
                  {Object.entries(
                    dragState.isNew
                      ? { [dragState.id]: { x: dragState.draftX, y: dragState.draftY, type: dragState.squareType } }
                      : Object.fromEntries(
                          (dragState.ids || [dragState.id]).map((id) => [
                            id,
                            {
                              x: dragState.draftPositions?.[id]?.x ?? dragState.originById[id].x,
                              y: dragState.draftPositions?.[id]?.y ?? dragState.originById[id].y,
                              type: dragState.originById[id].type,
                            },
                          ])
                        )
                  ).map(([id, pos]) => (
                    <div
                      key={id}
                      style={{
                        position: "absolute",
                        left: `${BOARD_OFFSET_X + pos.x}px`,
                        top: `${BOARD_OFFSET_Y + pos.y}px`,
                        width: `${CELL_SIZE}px`,
                        height: `${CELL_SIZE}px`,
                        border: "none",
                        borderRadius: `${TILE_RADIUS}px`,
                        background: dragState.blocked
                          ? "rgba(255, 120, 120, 0.35)"
                          : getTypeColor(pos.type, ["topCorner", "bottomLeftCorner", "bottomRightCorner"].includes(pos.type)),
                        opacity: 0.78,
                        zIndex: 5,
                        pointerEvents: "none",
                        boxSizing: "border-box",
                      }}
                    >
                      <TileOutline color={dragState.overTrash ? "#cf2f2f" : "#111"} opacity={0.95} />
                    </div>
                  ))}
                </>
              )}

              {mode === "editor" && (
                <div
                  ref={trashRef}
                  className={`absolute bottom-4 left-4 flex h-[88px] w-[88px] items-center justify-center rounded-[24px] border-2 ${dragState?.overTrash ? "border-[#cf2f2f] bg-[#ffe7e7]" : "border-[#d3d3d3] bg-white"}`}
                >
                  <Trash2 size={32} strokeWidth={1.8} color={dragState?.overTrash ? "#cf2f2f" : "#333"} />
                </div>
              )}
            </div>
          </div>
        </div>

          <div
            ref={mode === "player" ? playerCluePaneRef : null}
            className={`${mode === "editor" ? "px-6 pb-6 pt-0 h-[calc((100vh-62px)*0.3)] flex flex-col justify-start" : isPlayerStackedLayout ? "px-5 pt-0 pb-8 flex flex-col items-start gap-6" : "px-0 pt-16 pb-6 flex flex-col items-start gap-6 min-h-full"}`}
          >

            {mode === "editor" && (
              <div className="relative w-full px-2 pt-0 pb-2 h-full flex flex-col justify-start overflow-visible">
                {activeHintEditor && (
                  <div
                    className="absolute z-20"
                    style={{
                      left: `calc(${activeHintEditor.clueIndex} * (100% / 3) + ${activeHintEditor.clueIndex} * 1rem)`,
                      top: "-132px",
                      width: "calc((100% - 2rem) / 3)",
                    }}
                  >
                    <div className="rounded-[18px] border border-[#d8d8d8] bg-white px-4 py-4 shadow-[0_16px_30px_rgba(0,0,0,0.08)]">
                      <div className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-black/55">
                        {SIDE_DISPLAY_LABELS[CLUE_SIDE_KEYS[activeHintEditor.clueIndex]]} {activeHintEditor.type} hint
                      </div>
                      <textarea
                        value={clues[activeHintEditor.clueIndex]?.hints?.[activeHintEditor.type] || ""}
                        onChange={(event) =>
                          updateHintText(activeHintEditor.clueIndex, activeHintEditor.type, event.target.value)
                        }
                        className="w-full rounded-[14px] border border-[#d8d8d8] px-4 py-3 outline-none"
                        placeholder="Type a hint for this highlighted section"
                        style={{
                          minHeight: "88px",
                          maxWidth: "100%",
                          resize: "vertical",
                          fontWeight: 500,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {HIGHLIGHTER_ITEMS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applyClueHighlight(item.id, item.color)}
                        className="flex items-center gap-2 rounded-full border border-[#d8d8d8] bg-white px-3 py-2 text-[13px] font-normal"
                      >
                        <span
                          className="inline-block h-4 w-4 rounded-full border border-black/20"
                          style={{ background: item.color || "#ffffff" }}
                        />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-6 items-end">
                  {clues.map((clue, index) => {
                    const colors = ["#efe6ff", "#e3f7e2", "#e3f0ff"];
                    return (
                      <ClueEditor
                        key={index}
                        clue={clue}
                        index={index}
                        color={colors[index]}
                        isActive={activeClueIndex === index}
                        registerEditor={registerClueEditor}
                        onActivate={setActiveClueIndex}
                        onChange={updateClue}
                        onHighlightClick={handleHighlightClick}
                        onPaste={handleCluePaste}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {mode === "player" && (
              <div
                ref={clueStackRef}
                className="w-full max-w-[440px] flex flex-col gap-0"
                style={{
                  width: `${PLAYER_CLUE_STACK_MAX_WIDTH}px`,
                  marginLeft: `${clueStackOffsetX / Math.max(playerClueStackScale, 0.001)}px`,
                  zoom: playerClueStackScale,
                }}
              >
                {playerClues.map((clue, index) => (
                  (() => {
                    const side = index === 0 ? "left" : index === 1 ? "right" : "base";
                    const isActive = activeSide === side;
                    const sectionHeading = HINT_SECTIONS[index]?.heading;
                    const allowedHintTypes = sectionHeading
                      ? Array.from(revealedHintTypesBySection[sectionHeading] || [])
                      : [];
                    return (
                  <div
                    key={index}
                    ref={(el) => {
                      clueRefs.current[index] = el;
                    }}
                    role="button"
                    tabIndex={isPlayerInputLocked ? -1 : 0}
                    aria-label={`Activate ${SIDE_DISPLAY_LABELS[side]} clue`}
                    onMouseDown={(event) => handlePlayerClueMouseDown(event, index)}
                    onClick={(event) => handlePlayerClueClick(event, index)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handlePlayerClueActivate(index);
                      }
                    }}
                    onMouseMove={(event) => handleClueHintHover(event, index)}
                    onMouseLeave={hideHintTooltip}
                    style={{
                      ...clueStyle(index),
                      width: "100%",
                      margin: 0,
                      color: shouldShowPlayerClues ? undefined : "transparent",
                      transition: "color 180ms ease",
                      userSelect: shouldShowPlayerClues ? "text" : "none",
                    }}
                  >
                    <AutoFitClueText
                      text={clue}
                      html={
                        shouldShowPlayerClues
                          ? clueHtmlToFilteredPlayerHtml(clues[index]?.html || "", allowedHintTypes)
                          : ""
                      }
                      fontFamily={PLAYER_UI_FONT}
                      fixedFontSize={sharedPlayerClueFontSize}
                      highlightStyles={playerClueHighlightStyles}
                      richTextClassName={`player-clue-rich${isActive ? " player-clue-rich-active" : ""}`}
                    />
                  </div>
                    );
                  })()
                ))}
              </div>
            )}
          </div>
        </div>
          </div>
          )}
        </div>
      </div>

      {showStartModal && mode === "player" && !showHowToPlay && !finishedState && (
        <div
          className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-center px-4"
          style={{ top: `${62 * playerBannerScale}px` }}
          onClick={beginGame}
        >
          <div
            className="relative w-full max-w-[420px] min-h-[520px] overflow-hidden rounded-[32px] border p-8 text-center shadow-[0_14px_34px_rgba(0,0,0,0.14)]"
            style={{ background: startModalBg, borderColor: startModalBorder, color: startModalTitleColor }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative flex min-h-[456px] flex-col items-center justify-center">
              <img
                src={trypticLogo}
                alt="The Tryptic logo"
                className="mb-4 w-[96px] h-auto"
              />
              <div
                className="text-[38px] font-semibold tracking-tight"
                style={{
                  fontFamily: PLAYER_UI_FONT,
                  color: startModalTitleColor,
                }}
              >
                The Tryptic
              </div>
              <p
                className="mt-5 max-w-[270px] text-[14px] leading-5"
                style={{
                  fontFamily: PLAYER_UI_FONT,
                  color: startModalBodyColor,
                }}
              >
                Will you get <em>tripped</em> up or find what makes this triangle <em>tick</em>?
              </p>
              <button
                type="button"
                onClick={beginGame}
                className="mt-14 rounded-full px-5 py-2.5 text-[14px] font-medium"
                style={{ background: startModalButtonBg, color: startModalButtonText }}
              >
                Play
              </button>
            </div>
          </div>
        </div>
      )}

      {showWelcomeBackModal && mode === "player" && !showHowToPlay && !finishedState && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-center px-4"
          style={{ top: `${62 * playerBannerScale}px` }}
          onClick={resumeGameForPlayerAction}
        >
          <div
            className="relative w-full max-w-[332px] rounded-[28px] border px-7 py-7 text-center shadow-[0_14px_34px_rgba(0,0,0,0.14)]"
            style={{ background: startModalBg, borderColor: startModalBorder, color: startModalTitleColor }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-[26px] font-semibold tracking-tight">Welcome back</div>
            <p className="mt-3 text-[14px] leading-5" style={{ color: startModalBodyColor }}>
              The Tryptic awaits...
            </p>
            <button
              type="button"
              onClick={resumeGameForPlayerAction}
              className="mt-6 rounded-full px-5 py-2.5 text-[14px] font-medium"
              style={{ background: startModalButtonBg, color: startModalButtonText }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {hoveredHintTooltip ? (
        <div
          className="absolute z-50 rounded-[18px] border-2 px-4 py-3 text-[15px] leading-5"
          style={{
            left: `${hoveredHintTooltip.centerX}px`,
            top: `${hoveredHintTooltip.top}px`,
            transform: "translateX(-50%)",
            width: `${hoveredHintTooltip.width}px`,
            maxWidth: `${hoveredHintTooltip.maxWidth}px`,
            boxSizing: "border-box",
            background: "#ffffff",
            borderColor: "#000000",
            color: "#000000",
            padding: `${12 * (hoveredHintTooltip.fontScale ?? 1)}px ${16 * (hoveredHintTooltip.fontScale ?? 1)}px`,
            pointerEvents: "none",
            textAlign: "left",
            overflowWrap: "break-word",
            whiteSpace: "normal",
          }}
        >
          <span
            style={{
              display: "block",
              textAlign: "left",
              textAlignLast: "left",
              whiteSpace: "normal",
              overflowWrap: "break-word",
              wordBreak: "normal",
              fontSize: `${15 * (hoveredHintTooltip.fontScale ?? 1)}px`,
              lineHeight: `${20 * (hoveredHintTooltip.fontScale ?? 1)}px`,
            }}
          >
            {(hoveredHintTooltip.hintSegments || getHintTooltipSegments(hoveredHintTooltip.hintText)).map(
              (segment, index) =>
                segment.bold ? (
                  <strong key={`${index}-${segment.text}`} style={{ fontWeight: 600 }}>
                    {segment.text}
                  </strong>
                ) : (
                  <Fragment key={`${index}-${segment.text}`}>{segment.text}</Fragment>
                )
            )}
          </span>
        </div>
      ) : null}

      {showHintConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/18 px-4"
          onClick={cancelHintOpen}
        >
          <div
            className="w-full max-w-[340px] rounded-[20px] border p-4 shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
            style={{ background: theme.modalBg, borderColor: theme.modalBorder, color: theme.modalText }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="mt-1 ml-1 text-[16px] font-semibold tracking-tight"
              style={{ fontFamily: PLAYER_UI_FONT }}
            >
              Are you sure you want to reveal a hint?
            </div>
            <label className="mt-4 ml-2 flex items-center gap-3 text-[13px]" style={{ color: theme.modalMutedText }}>
              <input
                type="checkbox"
                checked={skipHintConfirm}
                onChange={(event) => setSkipHintConfirm(event.target.checked)}
                className="h-4 w-4 rounded"
                style={{ borderColor: theme.inputBorder, accentColor: theme.clueActiveBg }}
              />
              Don&apos;t ask again
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelHintOpen}
                className="rounded-full border px-4 py-2 text-[14px]"
                style={{ borderColor: theme.modalBorder, color: theme.modalText }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmHintOpen}
                className="rounded-full px-4 py-2 text-[14px]"
                style={{ background: theme.clueInactiveBg, color: "#000000" }}
              >
                Show Hint
              </button>
            </div>
          </div>
        </div>
      )}

      {showRevealConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/18 px-4"
          onClick={cancelRevealAction}
        >
          <div
            className="w-full max-w-[340px] rounded-[20px] border p-4 shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
            style={{ background: theme.modalBg, borderColor: theme.modalBorder, color: theme.modalText }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="mt-1 ml-1 text-[16px] font-semibold tracking-tight"
              style={{ fontFamily: PLAYER_UI_FONT }}
            >
              Are you sure you want to reveal {pendingRevealLabel}?
            </div>
            <label className="mt-4 ml-2 flex items-center gap-3 text-[13px]" style={{ color: theme.modalMutedText }}>
              <input
                type="checkbox"
                checked={skipRevealConfirm}
                onChange={(event) => setSkipRevealConfirm(event.target.checked)}
                className="h-4 w-4 rounded"
                style={{ borderColor: theme.inputBorder, accentColor: theme.clueActiveBg }}
              />
              Don&apos;t ask again
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelRevealAction}
                className="rounded-full border px-4 py-2 text-[14px]"
                style={{ borderColor: theme.modalBorder, color: theme.modalText }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRevealAction}
                className="rounded-full px-4 py-2 text-[14px]"
                style={{ background: theme.clueInactiveBg, color: "#000000" }}
              >
                Reveal
              </button>
            </div>
          </div>
        </div>
      )}

      {showSolvedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 px-4"
          onClick={() => setShowSolvedModal(false)}
        >
          <div
            className="relative w-full max-w-[420px] min-h-[520px] overflow-hidden rounded-[32px] border p-8 text-center shadow-[0_14px_34px_rgba(0,0,0,0.14)]"
            style={{ background: solvedModalBg, borderColor: solvedModalBorder }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative flex min-h-[456px] flex-col items-center justify-center">
              <style>
                {`
                  @keyframes huzzah-bounce {
                    0% {
                      transform: translateY(0) scale(1);
                      animation-timing-function: cubic-bezier(0.24, 0.78, 0.26, 1);
                    }
                    18% {
                      transform: translateY(-13px) scale(1.04);
                      animation-timing-function: cubic-bezier(0.24, 0.68, 0.3, 1);
                    }
                    36% {
                      transform: translateY(4px) scale(0.972);
                      animation-timing-function: cubic-bezier(0.22, 0.7, 0.26, 1);
                    }
                    60% {
                      transform: translateY(-8px) scale(1.022);
                      animation-timing-function: cubic-bezier(0.24, 0.58, 0.3, 1);
                    }
                    82% {
                      transform: translateY(1px) scale(0.995);
                      animation-timing-function: cubic-bezier(0.28, 0.45, 0.34, 1);
                    }
                    100% { transform: translateY(0) scale(1); }
                  }
                `}
              </style>
              <div className="text-[14px] font-semibold uppercase tracking-[0.14em]" style={{ color: solvedModalLabelText }}>
                Tryptic Triumphed
              </div>
              <div
                className="mt-4 text-[38px] font-semibold tracking-tight"
                style={{
                  fontFamily: PLAYER_UI_FONT,
                  color: solvedModalText,
                  animation: "huzzah-bounce 1560ms both",
                  willChange: "transform",
                }}
              >
                Huzzah!
              </div>
              <p
                className="mt-5 max-w-[280px] text-[18px] leading-8"
                style={{
                  fontFamily: PLAYER_UI_FONT,
                  color: solvedModalBodyText,
                }}
              >
                Solved in {formatTime(seconds)}
              </p>
              <div className="mt-5 flex min-h-[36px] items-center justify-center gap-3" style={{ color: solvedModalText }}>
                {solvedTimeline.map((item, index) => {
                  if (item === "⭐ ⭐ ⭐") {
                    return (
                      <div
                        key={`timeline-${index}`}
                        className="flex flex-col items-center justify-center text-[26px] leading-none"
                      >
                        <div>⭐</div>
                        <div className="mt-1 flex items-center justify-center gap-2">
                          <span>⭐</span>
                          <span>⭐</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`timeline-${index}`}
                      className={item === "💡" || item === "🔎" ? "text-[23px] leading-none -mx-0.5" : "text-[28px] leading-none"}
                    >
                      {item}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setShowSolvedModal(false)}
                className="mt-10 rounded-full px-5 py-2.5 text-[15px] font-medium"
                style={{ background: theme.solvedButtonBg, color: theme.solvedButtonText }}
              >
                Enjoy triangles
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
