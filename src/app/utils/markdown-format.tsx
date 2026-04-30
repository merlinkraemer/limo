import React from 'react';

type FormatRule = {
  pattern: RegExp;
  tag: keyof React.JSX.IntrinsicElements;
  recurse: boolean;
};

const rules: FormatRule[] = [
  { pattern: /\*\*([^*\n]+?)\*\*/, tag: 'strong', recurse: true },
  { pattern: /__([^_\n]+?)__/, tag: 'strong', recurse: true },
  { pattern: /(?<!\*)\*([^*\n]+?)\*(?!\*)/, tag: 'em', recurse: true },
  { pattern: /(?<!_)_([^_\n]+?)_(?!_)/, tag: 'em', recurse: true },
  { pattern: /~~([^~\n]+?)~~/, tag: 's', recurse: true },
  { pattern: /`([^`\n]+?)`/, tag: 'code', recurse: false },
];

export function formatMarkdown(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    let earliest: {
      index: number;
      length: number;
      content: string;
      tag: keyof React.JSX.IntrinsicElements;
      recurse: boolean;
    } | null = null;

    for (const rule of rules) {
      const match = rule.pattern.exec(remaining);
      if (!match) continue;
      if (earliest === null || match.index < earliest.index) {
        earliest = {
          index: match.index,
          length: match[0].length,
          content: match[1],
          tag: rule.tag,
          recurse: rule.recurse,
        };
      }
    }

    if (!earliest) {
      result.push(remaining);
      break;
    }

    if (earliest.index > 0) {
      result.push(remaining.slice(0, earliest.index));
    }

    const Tag = earliest.tag;
    const children = earliest.recurse ? formatMarkdown(earliest.content) : earliest.content;
    result.push(<Tag key={key++}>{children}</Tag>);
    remaining = remaining.slice(earliest.index + earliest.length);
  }

  return result;
}
