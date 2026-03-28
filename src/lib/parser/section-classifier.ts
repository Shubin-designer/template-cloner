import type { NodeType } from '@/types/component-tree';

interface ClassificationInput {
  tag: string;
  className?: string;
  id?: string;
  childCount: number;
  hasImage: boolean;
  hasText: boolean;
  hasButton: boolean;
  hasInput: boolean;
  depth: number;
  isFirstLargeSection: boolean;
  parentWidth?: number;
  elementWidth?: number;
}

const SEMANTIC_TAG_MAP: Record<string, NodeType> = {
  header: 'header',
  nav: 'nav',
  footer: 'footer',
  main: 'section',
  section: 'section',
  article: 'card',
  aside: 'block',
  form: 'form',
  button: 'button',
  a: 'link',
  img: 'image',
  video: 'video',
  input: 'input',
  textarea: 'input',
  select: 'input',
  ul: 'list',
  ol: 'list',
};

const CLASS_PATTERNS: [RegExp, NodeType][] = [
  [/hero/i, 'hero'],
  [/nav(bar|igation)?/i, 'nav'],
  [/head(er)?/i, 'header'],
  [/foot(er)?/i, 'footer'],
  [/card/i, 'card'],
  [/btn|button/i, 'button'],
  [/form/i, 'form'],
  [/menu/i, 'nav'],
  [/banner/i, 'hero'],
  [/sidebar/i, 'block'],
];

export function classifySection(input: ClassificationInput): NodeType {
  const { tag, className, id, depth } = input;

  // 1. Semantic HTML tags (highest priority)
  const tagType = SEMANTIC_TAG_MAP[tag.toLowerCase()];
  if (tagType) return tagType;

  // 2. Class/ID pattern matching
  const textToCheck = `${className || ''} ${id || ''}`;
  for (const [pattern, type] of CLASS_PATTERNS) {
    if (pattern.test(textToCheck)) return type;
  }

  // 3. Heuristic: first large section is likely hero
  if (input.isFirstLargeSection && depth <= 2) {
    return 'hero';
  }

  // 4. Depth-based classification
  if (depth <= 1) return 'section';
  if (depth <= 3) return 'block';

  return 'element';
}

/**
 * Classify by looking at the tag, classes, and structural context.
 * Returns the best-guess NodeType.
 */
export function classifySectionFromDOM(
  tag: string,
  className: string | undefined,
  id: string | undefined,
  childInfo: {
    childCount: number;
    hasImage: boolean;
    hasText: boolean;
    hasButton: boolean;
    hasInput: boolean;
  },
  depth: number,
  isFirstLargeSection: boolean
): NodeType {
  return classifySection({
    tag,
    className,
    id,
    ...childInfo,
    depth,
    isFirstLargeSection,
  });
}
