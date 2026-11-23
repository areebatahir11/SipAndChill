'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, DataTable, PageHeader, Pill, Select, StatCard, Td } from '@/components/ui';
import { useAuth } from '@/components/layout/AuthProvider';
import { dateOnly, money } from '@/lib/format';
import { METHOD_LABEL } from '@/lib/payments.mjs';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import ExpenseFormDialog from './ExpenseFormDialog';
import VoidExpenseDialog from './VoidExpenseDialog';
import PurgeExpenseDialog from './PurgeExpenseDialog';
import CategoriesDialog from './CategoriesDialog';

export default function ExpensesManager({ data, categories, suppliers, view, rangeError, children }) {
  const router = useRouter();
  const { can } = useAuth();
  const canManage = can(P.EXPENSES_MANAGE);
  const canPurge = can(P.EXPENSES_PURGE); // Business Owner only
  const [dialog, setDialog] = useState(null); // { type: 'form' | 'void' | 'purge' | 'categories', expense? }
  const [notice, setNotice] = useState('');
  const { rows, summary, page, pages, total } = data;
  const rangeText = view.from === view.to ? view.from : `${view.from} to ${view.to}`;

  const go = (next = {}) => {
    const q = new URLSearchParams({ range: view.preset, ...(view.preset === 'custom' ? { from: view.from, to: view.to } : {}) });
    const category = next.category ?? view.categoryId;
    if (category) q.set('category', category);
    if (next.page > 1) q.set('page', String(next.page));
    router.push(`/expenses?${q}`);
  };
  const close = () => setDialog(null);
  const saved = (msg) => { close(); setNotice(msg); router.refresh(); };

  return (
    <>
      <PageHeader title="Expenses" sub={`${view.label} · ${rangeText}`}>
        {canManage && <Button variant="ghost" onClick={() => setDialog({ type: 'categories' })}>Categories</Button>}
        {canManage && <Button variant="primary" onClick={() => setDialog({ type: 'form' })}>Add expense</Button>}
      </PageHeader>

      {rangeError && <Alert className="mb-4">{rangeError} Showing today instead.</Alert>}
      {notice && <Alert tone="success" className="mb-4">{notice}</Alert>}
      {children}

      <div className="mb-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total spent" value={money(summary.total)} hint={`${summary.count} ${summary.count === 1 ? 'entry' : 'entries'}`} />
        <StatCard label="Spent on stock" value={money(summary.stock)} hint="Milk, fruit, cups… bought from the Stock page" />
        <StatCard label="Other expenses" value={money(summary.other)} hint="Rent, bills, salaries and so on" />
        <StatCard label="Paid in cash" value={money(summary.cash)} hint="Came out of the drawer" />
      </div>
      <p className="mb-1 text-[13px] text-graphite">Voided entries are shown greyed out and are never counted.</p>
      <p className="mb-4 text-[13px] text-graphite">
        Bought milk, fruit, cups or other stock? Add it from the <Link href="/ingredients" className="font-medium text-slate underline">Stock page</Link> with Record purchase, not here. That updates your stock and your spending together.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate">
          Category
          <Select className="w-56" value={view.categoryId} onChange={(e) => go({ category: e.target.value, page: 1 })}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.isActive ? '' : ' (hidden)'}</option>)}
          </Select>
        </label>
      </div>

      <DataTable head={['Date', 'Category', 'Details', 'Paid by', 'Amount', 'Entered by', '']} emptyText={rows.length === 0 ? (view.categoryId ? 'No expenses in this category for this period.' : 'No expenses in this period. Add rent, bills or other spending, or buy stock from the Stock page.') : null}>
        {rows.map((e) => (
          <tr key={e.id} className={e.voided ? 'opacity-55' : ''}>
            <Td className="whitespace-nowrap">{dateOnly(e.businessDate)}</Td>
            <Td className="whitespace-nowrap">{e.categoryName}{e.source === 'STOCK_PURCHASE' && <> <Pill>From stock</Pill></>}</Td>
            <Td>
              {e.note || '—'}
              {e.supplierName && <small className="block text-graphite">{e.supplierName}</small>}
              {e.voided && <small className="block text-graphite">Voided: {e.voidReason}</small>}
            </Td>
            <Td className="whitespace-nowrap">{METHOD_LABEL[e.method]}</Td>
            <Td className={`whitespace-nowrap font-semibold ${e.voided ? 'line-through' : ''}`}>{money(e.amount)}</Td>
            <Td className="whitespace-nowrap">{e.createdByName || '—'}</Td>
            <Td className="text-right">
              {canManage && !e.voided && e.source === 'MANUAL' && <Button size="sm" variant="danger" onClick={() => setDialog({ type: 'void', expense: e })}>Void</Button>}
              {e.voided && <Pill tone="off">Voided</Pill>}
              {e.voided && canPurge && e.source === 'MANUAL' && <Button size="sm" variant="danger" className="ml-2" onClick={() => setDialog({ type: 'purge', expense: e })}>Delete…</Button>}
            </Td>
          </tr>
        ))}
      </DataTable>

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-graphite">
          <span>Page {page} of {pages} · {total} entries</span>
          <span className="flex gap-2">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => go({ page: page - 1 })}>Previous</Button>
            <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => go({ page: page + 1 })}>Next</Button>
          </span>
        </div>
      )}

      {summary.byCategory.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-2 text-lg font-semibold">Where the money went</h2>
          <ul className="grid gap-1.5">
            {summary.byCategory.map((c) => (
              <li key={c.id} className="flex justify-between gap-3 border-b border-blush pb-1.5 last:border-0"><span>{c.name}</span><b>{money(c.amount)}</b></li>
            ))}
          </ul>
        </Card>
      )}

      {dialog?.type === 'form' && <ExpenseFormDialog categories={categories} suppliers={suppliers} onSaved={saved} onClose={close} />}
      {dialog?.type === 'void' && <VoidExpenseDialog expense={dialog.expense} onSaved={saved} onClose={close} />}
      {dialog?.type === 'purge' && <PurgeExpenseDialog expense={dialog.expense} onSaved={saved} onClose={close} />}
      {dialog?.type === 'categories' && <CategoriesDialog categories={categories} onChanged={() => router.refresh()} onClose={close} />}
    </>
  );
}
