export type SpecKind = 'design' | 'impl';

export type ElementRole =
  | 'button'
  | 'input'
  | 'link'
  | 'heading'
  | 'text'
  | 'image'
  | 'icon'
  | 'card'
  | 'nav'
  | 'container'
  | 'list'
  | 'form'
  | 'label'
  | 'avatar'
  | 'banner'
  | 'other';

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Styles {
  color?: string;
  bg?: string;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  radius?: number;
  border?: string;
  shadow?: string;
  spacing?: number;
}

export interface A11y {
  label?: string;
  ariaProps?: Record<string, unknown>;
}

export interface Locator {
  css?: string;
  role?: string;
  testId?: string;
  text?: string;
}

export interface Element {
  id: string;
  name: string;
  type: string;
  role: ElementRole;
  text?: string;
  bounds: Bounds;
  styles?: Styles;
  a11y?: A11y;
  /** impl-spec only */
  locator?: Locator;
  /** impl-spec only: computed values read from the live DOM */
  actual?: Record<string, unknown>;
  /** dynamic content excluded from pixel diff */
  masked?: boolean;
}

export interface Interaction {
  id: string;
  trigger: string;
  target: string;
  expected: string;
  precondition?: string;
  context?: string;
}

export interface Spec {
  schemaVersion: 1;
  kind: SpecKind;
  screen: {
    id: string;
    name: string;
    source: string;
    figmaFileKey?: string;
    frameId?: string;
    designVersion?: string;
    retrievedAt: string;
  };
  viewport: {
    width: number;
    height: number;
    deviceScaleFactor?: number;
  };
  elements: Element[];
  interactions: Interaction[];
}
