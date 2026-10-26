export const ALL = '__all__';

interface Props {
  groups: string[];
  counts: Map<string, number>;
  total: number;
  active: string;
  onSelect: (g: string) => void;
}

export function CategoryList({ groups, counts, total, active, onSelect }: Props) {
  const items = [{ key: ALL, label: 'All channels', count: total }, ...groups.map((g) => ({ key: g, label: g, count: counts.get(g) ?? 0 }))];
  return (
    <nav className="cats" data-nav-region="cats" aria-label="Categories">
      {items.map((it) => (
        <button
          key={it.key}
          className={'cat' + (it.key === active ? ' is-active' : '')}
          data-focusable
          aria-pressed={it.key === active}
          data-autofocus={it.key === active ? '' : undefined}
          onClick={() => onSelect(it.key)}
        >
          <span className="cat__label">{it.label}</span>
          <span className="cat__count">{it.count}</span>
        </button>
      ))}
    </nav>
  );
}
