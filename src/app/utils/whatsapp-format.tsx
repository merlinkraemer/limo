import React from 'react';

type FormatRule = {
  pattern: RegExp;
  tag: keyof React.JSX.IntrinsicElements;
};

const rules: FormatRule[] = [
  { pattern: /\*([^*]+)\*/, tag: 'strong' },
  { pattern: /_([^_]+)_/, tag: 'em' },
  { pattern: /~([^~]+)~/, tag: 's' },
  { pattern: /`([^`]+)`/, tag: 'code' },
];

export function formatWhatsApp(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    let earliestMatch: { index: number; length: number; content: string; tag: keyof React.JSX.IntrinsicElements } | null = null;

    for (const rule of rules) {
      const match = rule.pattern.exec(remaining);
      if (match && (earliestMatch === null || match.index < earliestMatch.index)) {
        earliestMatch = {
          index: match.index,
          length: match[0].length,
          content: match[1],
          tag: rule.tag,
        };
      }
    }

    if (!earliestMatch) {
      result.push(remaining);
      break;
    }

    if (earliestMatch.index > 0) {
      result.push(remaining.slice(0, earliestMatch.index));
    }

    const Tag = earliestMatch.tag;
    const children = formatWhatsApp(earliestMatch.content);
    result.push(<Tag key={key++}>{children}</Tag>);
    remaining = remaining.slice(earliestMatch.index + earliestMatch.length);
  }

  return result;
}
