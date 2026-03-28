export type NodeType =
  | 'page'
  | 'section'
  | 'block'
  | 'element'
  | 'text'
  | 'image'
  | 'button'
  | 'nav'
  | 'header'
  | 'footer'
  | 'hero'
  | 'card'
  | 'form'
  | 'link'
  | 'list'
  | 'video'
  | 'input';

export interface StyleData {
  // Layout
  display?: string;
  flexDirection?: string;
  flexWrap?: string;
  alignItems?: string;
  justifyContent?: string;
  gap?: string;
  gridTemplateColumns?: string;
  // Spacing
  padding?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  margin?: string;
  // Colors
  backgroundColor?: string;
  color?: string;
  backgroundImage?: string;
  // Typography
  fontSize?: string;
  fontFamily?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign?: string;
  textTransform?: string;
  textDecoration?: string;
  // Dimensions
  width?: string;
  height?: string;
  minWidth?: string;
  maxWidth?: string;
  minHeight?: string;
  // Border
  borderRadius?: string;
  borderWidth?: string;
  borderColor?: string;
  borderStyle?: string;
  border?: string;
  // Effects
  boxShadow?: string;
  opacity?: string;
  // Position
  position?: string;
  overflow?: string;
  zIndex?: string;
}

export interface ComponentNode {
  id: string;
  type: NodeType;
  tag: string;
  className?: string;
  children: ComponentNode[];
  styles: StyleData;
  textContent?: string;
  attributes?: Record<string, string>;
  depth: number;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
