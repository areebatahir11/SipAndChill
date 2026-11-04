import Card from './Card';

export function DataTable({ head, children, emptyText, colSpan }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap border-b border-peach bg-blush px-3.5 py-3.5 text-left text-[13px] font-semibold text-slate first:pl-5 last:pr-5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr:last-child>td]:border-b-0 [&>tr:hover>td]:bg-blush">
          {children}
          {emptyText && <tr><td colSpan={colSpan || head.length} className="p-9 text-center text-graphite">{emptyText}</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

export const Td = ({ className = '', ...props }) => (
  <td className={`border-b border-blush px-3.5 py-3.5 align-middle first:pl-5 last:pr-5 ${className}`} {...props} />
);
