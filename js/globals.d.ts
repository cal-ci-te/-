// js/globals.d.ts

// ===== 扩展基础 DOM 类型，让 TypeScript 认识常见属性和方法 =====

interface EventTarget {
  files?: FileList;
  closest(selector: string): Element | null;
  key?: string;
  value?: string;
  result?: string | ArrayBuffer;
}

interface Element {
  style: CSSStyleDeclaration;
  dataset: DOMStringMap;
  value: string;
  src: string;
  files: FileList;
  offsetWidth: number;
  offsetHeight: number;
  getContext(contextId: '2d', options?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D | null;
  width: number;
  height: number;
  title: string;
  checked: boolean;
  content: DocumentFragment;
}

interface HTMLElement {
  dataset: DOMStringMap;
  style: CSSStyleDeclaration;
  offsetWidth: number;
  offsetHeight: number;
  // 全屏 API
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

interface Document {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
}

// ===== 声明项目中的全局变量 =====

declare const UI: {
  refreshDisplay: () => void;
};

declare const ArticleService: any;
declare const DOMRefs: any;
declare const DecoShelf: any;
declare const Texture: any;
declare const Watermark: any;
declare const HeroBackground: any;
declare const Admin: any;
declare const AdminPanel: any;
declare const AdminEvents: any;
declare const AdminPosition: any;
declare const AdminState: any;
declare const EventBus: any;
declare const AppState: any;
declare const EVENTS: any;
declare const Utils: any;
declare const NotificationService: any;
declare const VisibilityService: any;
declare const Article: any;
declare const UIDetail: any;
declare const UIController: any;
declare const Sidebar: any;
declare const UISearch: any;
declare const UIDirectory: any;
declare const UIArticles: any;
declare const UIHelpers: any;

// ===== 扩展 Window =====

interface Window {
  UI: typeof UI;
  ArticleService: any;
  DOMRefs: any;
  DecoShelf: any;
  Texture: any;
  Watermark: any;
  HeroBackground: any;
  Admin: any;
  AdminPanel: any;
  AdminEvents: any;
  AdminPosition: any;
  AdminState: any;
  EventBus: any;
  AppState: any;
  EVENTS: any;
  Utils: any;
  NotificationService: any;
  VisibilityService: any;
  Article: any;
  UIDetail: any;
  UIController: any;
  Sidebar: any;
  UISearch: any;
  UIDirectory: any;
  UIArticles: any;
  UIHelpers: any;
  DecoShelfUI: any;
  _UIDetail?: {
    openDetail: (id: number) => void;
  };
  _UISidebar?: {
    sidebarCollapsed: boolean;
    toggleCollapse: () => void;
  };
}

// ===== import.meta.env =====

interface ImportMeta {
  env: {
    VITE_API_BASE_URL?: string;
    [key: string]: any;
  };
}