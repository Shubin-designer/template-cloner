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
  display?: string;
  flexDirection?: string;
  alignItems?: string;
  justifyContent?: string;
  gap?: string;
  padding?: string;
  margin?: string;
  backgroundColor?: string;
  color?: string;
  fontSize?: string;
  fontFamily?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign?: string;
  borderRadius?: string;
  border?: string;
  boxShadow?: string;
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  maxWidth?: string;
  position?: string;
  overflow?: string;
  opacity?: string;
  gridTemplateColumns?: string;
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
