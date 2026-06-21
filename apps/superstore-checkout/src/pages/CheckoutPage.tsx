import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';

import { useAuth } from '@/hooks/AuthContext';
import {
  createSale,
  findOrCreateCustomer,
  getProducts,
  priceLine,
  seedCatalog,
  summarize,
  type CartLine,
  type Customer,
  type PaymentMethod,
  type Product,
  type SaleResult,
} from '@/services/store';

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const pct = (n: number) => `${Math.round(n * 100)}%`;

type Step = 'phone' | 'shop' | 'review' | 'done';

const PAYMENTS: { id: PaymentMethod; label: string; icon: ReactNode }[] = [
  { id: 'card', label: 'Card', icon: <CardIcon /> },
  { id: 'cash', label: 'Cash', icon: <CashIcon /> },
  { id: 'wallet', label: 'Wallet', icon: <WalletIcon /> },
];

export function CheckoutPage() {
  const { user, signOut } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [products, setProducts] = useState<Product[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [starting, setStarting] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('card');

  const [processing, setProcessing] = useState(false);
  const [sale, setSale] = useState<SaleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setCatalogError(null);
    try {
      setProducts(await getProducts());
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const needsSeed = products !== null && products.length === 0;
  const summary = useMemo(() => summarize(cart), [cart]);

  const filtered = useMemo(() => {
    const list = products ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.subCategory.toLowerCase().includes(q),
    );
  }, [products, search]);

  const inCart = useCallback(
    (id: string) => cart.find((l) => l.product.id === id)?.quantity ?? 0,
    [cart],
  );

  function addToCart(p: Product) {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.product.id === p.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [...prev, { product: p, quantity: 1 }];
    });
  }

  function setQty(id: string, qty: number) {
    setCart((prev) =>
      prev.flatMap((l) =>
        l.product.id === id ? (qty <= 0 ? [] : [{ ...l, quantity: qty }]) : [l],
      ),
    );
  }

  function removeLine(id: string) {
    setCart((prev) => prev.filter((l) => l.product.id !== id));
  }

  async function onSeed() {
    setSeeding(true);
    try {
      await seedCatalog();
      await loadCatalog();
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : String(e));
    } finally {
      setSeeding(false);
    }
  }

  async function onStart(e: FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setStarting(true);
    setError(null);
    try {
      const c = await findOrCreateCustomer(phone, name);
      setCustomer(c);
      setStep('shop');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  }

  async function onFinish() {
    if (!customer || cart.length === 0) return;
    setProcessing(true);
    setError(null);
    try {
      const result = await createSale(customer, cart, payment);
      setSale(result);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessing(false);
    }
  }

  function newSale() {
    setCart([]);
    setCustomer(null);
    setPhone('');
    setName('');
    setSearch('');
    setPayment('card');
    setSale(null);
    setError(null);
    setStep('phone');
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      <Header
        operator={user?.name ?? 'Operator'}
        customer={customer}
        step={step}
        onSignOut={() => void signOut()}
        onChangeCustomer={() => setStep('phone')}
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-40 pt-7">
        {error && (
          <div className="mb-4 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-[13px] text-danger">
            {error}
          </div>
        )}

        {step === 'phone' && (
          <PhoneGate
            phone={phone}
            name={name}
            starting={starting}
            onPhone={setPhone}
            onName={setName}
            onSubmit={onStart}
          />
        )}

        {step === 'shop' && (
          <Shop
            products={products}
            filtered={filtered}
            search={search}
            onSearch={setSearch}
            needsSeed={needsSeed}
            seeding={seeding}
            onSeed={onSeed}
            catalogError={catalogError}
            cart={cart}
            inCart={inCart}
            onAdd={addToCart}
            onQty={setQty}
            onRemove={removeLine}
          />
        )}

        {step === 'review' && customer && (
          <Review
            customer={customer}
            cart={cart}
            summary={summary}
            payment={payment}
            processing={processing}
            onBack={() => setStep('shop')}
            onFinish={() => void onFinish()}
          />
        )}

        {step === 'done' && sale && (
          <Done sale={sale} payment={payment} onNew={newSale} />
        )}
      </main>

      {step === 'shop' && !needsSeed && products !== null && (
        <SummaryBar
          summary={summary}
          payment={payment}
          onPayment={setPayment}
          disabled={cart.length === 0}
          onCheckout={() => setStep('review')}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- header -- */

function Header({
  operator,
  customer,
  step,
  onSignOut,
  onChangeCustomer,
}: {
  operator: string;
  customer: Customer | null;
  step: Step;
  onSignOut: () => void;
  onChangeCustomer: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-panel">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white">
            <CartIcon />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">Superstore</div>
            <div className="text-[11px] text-faint">Self-checkout</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {customer && step !== 'phone' && (
            <button
              onClick={onChangeCustomer}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-muted transition-colors hover:text-ink"
              title="Change shopper"
            >
              <UserIcon />
              <span className="tabular-nums">{customer.phone}</span>
            </button>
          )}
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-[12px] font-medium text-ink">{operator}</div>
            <button
              onClick={onSignOut}
              className="text-[11px] text-faint transition-colors hover:text-danger"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------ phone gate -- */

function PhoneGate({
  phone,
  name,
  starting,
  onPhone,
  onName,
  onSubmit,
}: {
  phone: string;
  name: string;
  starting: boolean;
  onPhone: (v: string) => void;
  onName: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome in.</h1>
          <p className="mt-1.5 text-[14px] text-muted">
            Enter your phone number to start your checkout.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-muted">
              Phone number
            </label>
            <input
              value={phone}
              onChange={(e) => onPhone(e.target.value)}
              inputMode="tel"
              autoFocus
              placeholder="+92 3XX XXXXXXX"
              className="h-14 w-full rounded-2xl border border-line bg-panel px-4 text-lg tabular-nums tracking-wide text-ink outline-none transition-shadow placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent-soft"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-muted">
              Name <span className="text-faint">(optional)</span>
            </label>
            <input
              value={name}
              onChange={(e) => onName(e.target.value)}
              placeholder="Ayesha Khan"
              className="h-12 w-full rounded-2xl border border-line bg-panel px-4 text-[15px] text-ink outline-none transition-shadow placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent-soft"
            />
          </div>
          <button
            type="submit"
            disabled={!phone.trim() || starting}
            className="mt-1 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[15px] font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-soft disabled:opacity-50"
          >
            {starting ? <Spinner /> : <>Start checkout <ArrowIcon /></>}
          </button>
        </form>

        <p className="mt-5 text-center text-[12px] text-faint">
          Your number identifies the receipt. Nothing else is required.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ shop -- */

function Shop({
  products,
  filtered,
  search,
  onSearch,
  needsSeed,
  seeding,
  onSeed,
  catalogError,
  cart,
  inCart,
  onAdd,
  onQty,
  onRemove,
}: {
  products: Product[] | null;
  filtered: Product[];
  search: string;
  onSearch: (v: string) => void;
  needsSeed: boolean;
  seeding: boolean;
  onSeed: () => void;
  catalogError: string | null;
  cart: CartLine[];
  inCart: (id: string) => number;
  onAdd: (p: Product) => void;
  onQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}) {
  if (catalogError) {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger-soft px-5 py-4 text-[13px] text-danger">
        Could not load the catalog. {catalogError}
      </div>
    );
  }

  if (needsSeed) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <BoxIcon />
        </span>
        <h2 className="text-lg font-semibold">Set up the store catalog</h2>
        <p className="mt-1.5 max-w-xs text-[13px] text-muted">
          The backend is empty. Load the product catalog once to start ringing up sales.
        </p>
        <button
          onClick={onSeed}
          disabled={seeding}
          className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          {seeding ? <Spinner /> : 'Load catalog'}
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-7">
      {/* Item search + results */}
      <section>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search the aisles…"
            className="h-13 w-full rounded-2xl border border-line bg-panel py-3.5 pl-12 pr-4 text-[15px] text-ink outline-none transition-shadow placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent-soft"
          />
        </div>

        {products === null ? (
          <CatalogSkeleton />
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {filtered.slice(0, 12).map((p) => {
              const qty = inCart(p.id);
              return (
                <li key={p.id}>
                  <button
                    onClick={() => onAdd(p)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-line bg-panel px-3.5 py-3 text-left transition-colors hover:border-accent/40 hover:bg-rail"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-medium">{p.name}</span>
                        {p.discountPct > 0 && (
                          <span className="shrink-0 rounded-full bg-savings-soft px-1.5 py-0.5 text-[10px] font-semibold text-savings">
                            {pct(p.discountPct)} off
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-faint">{p.category}</div>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-muted">
                      {money(p.unitPrice)}
                    </span>
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-white"
                      aria-hidden
                    >
                      {qty > 0 ? <span className="text-[13px] font-bold tabular-nums">{qty}</span> : <PlusIcon />}
                    </span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="col-span-full py-8 text-center text-[13px] text-faint">
                No items match “{search}”.
              </li>
            )}
          </ul>
        )}
      </section>

      {/* Cart */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-faint">
            Your basket
          </h2>
          {cart.length > 0 && (
            <span className="text-[12px] text-faint tabular-nums">
              {cart.reduce((n, l) => n + l.quantity, 0)} items
            </span>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-panel/60 px-5 py-10 text-center">
            <p className="text-[14px] font-medium text-muted">Your basket is empty</p>
            <p className="mt-1 text-[12px] text-faint">
              Search above and tap an item to add it.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
            {cart.map(({ product, quantity }) => {
              const line = priceLine(product, quantity);
              return (
                <li key={product.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium">{product.name}</span>
                      {product.discountPct > 0 && (
                        <span className="shrink-0 rounded-full bg-savings-soft px-1.5 py-0.5 text-[10px] font-semibold text-savings">
                          {pct(product.discountPct)} off
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-faint tabular-nums">
                      {money(product.unitPrice)} each
                    </div>
                  </div>

                  <Stepper
                    value={quantity}
                    onDec={() => onQty(product.id, quantity - 1)}
                    onInc={() => onQty(product.id, quantity + 1)}
                  />

                  <div className="w-20 text-right text-[14px] font-semibold tabular-nums">
                    {money(line.lineTotal)}
                  </div>

                  <button
                    onClick={() => onRemove(product.id)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-danger-soft hover:text-danger"
                    aria-label={`Remove ${product.name}`}
                  >
                    <TrashIcon />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ---------------------------------------------------------- summary bar --- */

function SummaryBar({
  summary,
  payment,
  onPayment,
  disabled,
  onCheckout,
}: {
  summary: ReturnType<typeof summarize>;
  payment: PaymentMethod;
  onPayment: (p: PaymentMethod) => void;
  disabled: boolean;
  onCheckout: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel">
      <div className="mx-auto max-w-3xl px-5 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 rounded-xl bg-rail p-1">
            {PAYMENTS.map((p) => (
              <button
                key={p.id}
                onClick={() => onPayment(p.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  payment === p.id
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {p.icon}
                <span className="hidden sm:inline">{p.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right leading-tight">
              {summary.discountTotal > 0 && (
                <div className="text-[11px] font-medium text-savings tabular-nums">
                  saved {money(summary.discountTotal)}
                </div>
              )}
              <div className="text-[11px] text-faint">Total</div>
              <div className="text-2xl font-semibold tabular-nums leading-none">
                {money(summary.total)}
              </div>
            </div>

            <button
              onClick={onCheckout}
              disabled={disabled}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent px-6 text-[15px] font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-soft disabled:opacity-40"
            >
              Checkout <ArrowIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- review -- */

function Review({
  customer,
  cart,
  summary,
  payment,
  processing,
  onBack,
  onFinish,
}: {
  customer: Customer;
  cart: CartLine[];
  summary: ReturnType<typeof summarize>;
  payment: PaymentMethod;
  processing: boolean;
  onBack: () => void;
  onFinish: () => void;
}) {
  const pay = PAYMENTS.find((p) => p.id === payment)!;
  return (
    <div className="mx-auto w-full max-w-md py-4">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
      >
        <ArrowIcon className="rotate-180" /> Back to basket
      </button>

      <h1 className="text-xl font-semibold tracking-tight">Review and pay</h1>
      <p className="mt-1 text-[13px] text-muted tabular-nums">
        Shopper {customer.phone}
      </p>

      <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
        {cart.map(({ product, quantity }) => {
          const line = priceLine(product, quantity);
          return (
            <li key={product.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-rail text-[11px] font-semibold tabular-nums text-muted">
                {quantity}
              </span>
              <span className="min-w-0 flex-1 truncate">{product.name}</span>
              <span className="font-medium tabular-nums">{money(line.lineTotal)}</span>
            </li>
          );
        })}
      </ul>

      <dl className="mt-4 space-y-1.5 px-1 text-[14px]">
        <Row label={`Subtotal (${summary.itemCount} items)`} value={money(summary.subtotal)} />
        {summary.discountTotal > 0 && (
          <Row
            label="Savings"
            value={`- ${money(summary.discountTotal)}`}
            tone="savings"
          />
        )}
        <div className="flex items-center justify-between border-t border-line pt-2.5">
          <dt className="text-[15px] font-semibold">Total</dt>
          <dd className="text-2xl font-semibold tabular-nums">{money(summary.total)}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center gap-2 rounded-xl bg-rail px-4 py-3 text-[13px] text-muted">
        <span className="text-accent">{pay.icon}</span>
        Paying by <span className="font-medium text-ink">{pay.label}</span>
      </div>

      <button
        onClick={onFinish}
        disabled={processing}
        className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[15px] font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-soft disabled:opacity-60"
      >
        {processing ? (
          <>
            <Spinner /> Processing…
          </>
        ) : (
          <>Finish payment {money(summary.total)}</>
        )}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ done -- */

function Done({
  sale,
  payment,
  onNew,
}: {
  sale: SaleResult;
  payment: PaymentMethod;
  onNew: () => void;
}) {
  const pay = PAYMENTS.find((p) => p.id === payment)!;
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
      <span className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success">
        <CheckIcon />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">Payment complete</h1>
      <p className="mt-1.5 text-[14px] text-muted">
        {sale.itemCount} items, paid by {pay.label.toLowerCase()}.
      </p>

      <div className="mt-7 w-full max-w-xs rounded-2xl border border-line bg-panel p-5">
        <div className="text-[11px] uppercase tracking-wide text-faint">Amount paid</div>
        <div className="mt-1 text-4xl font-semibold tabular-nums">{money(sale.total)}</div>
        {sale.discountTotal > 0 && (
          <div className="mt-1.5 text-[12px] font-medium text-savings tabular-nums">
            You saved {money(sale.discountTotal)}
          </div>
        )}
        <div className="mt-4 border-t border-line pt-3 text-[11px] text-faint">
          Recorded to Fabric · #{sale.id.slice(0, 8)}
        </div>
      </div>

      <button
        onClick={onNew}
        className="mt-7 inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-ink px-7 py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        New sale
      </button>
    </div>
  );
}

/* -------------------------------------------------------------- partials -- */

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'savings';
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={`tabular-nums ${tone === 'savings' ? 'text-savings' : 'text-ink'}`}>
        {value}
      </dd>
    </div>
  );
}

function Stepper({
  value,
  onDec,
  onInc,
}: {
  value: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
      <button
        onClick={onDec}
        className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-rail hover:text-ink"
        aria-label="Decrease quantity"
      >
        <MinusIcon />
      </button>
      <span className="w-6 text-center text-[14px] font-semibold tabular-nums">{value}</span>
      <button
        onClick={onInc}
        className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-rail hover:text-ink"
        aria-label="Increase quantity"
      >
        <PlusIcon />
      </button>
    </div>
  );
}

function CatalogSkeleton() {
  return (
    <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="h-[58px] animate-pulse rounded-xl border border-line bg-rail/60"
        />
      ))}
    </ul>
  );
}

/* --------------------------------------------------------------- icons --- */

const sw = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function CartIcon() {
  return (
    <svg {...sw} width={20} height={20}>
      <path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.3h8.2a1.5 1.5 0 0 0 1.5-1.2L21 8H6" />
      <circle cx="9.5" cy="20" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="20" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg {...sw} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.4-3.4" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg {...sw} width={16} height={16}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function MinusIcon() {
  return (
    <svg {...sw} width={16} height={16}>
      <path d="M5 12h14" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg {...sw} width={16} height={16}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </svg>
  );
}
function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg {...sw} className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg {...sw} width={30} height={30} strokeWidth={2}>
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg {...sw} width={15} height={15}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}
function BoxIcon() {
  return (
    <svg {...sw} width={26} height={26}>
      <path d="M21 8 12 3 3 8l9 5 9-5ZM3 8v8l9 5 9-5V8M12 13v8" />
    </svg>
  );
}
function CardIcon() {
  return (
    <svg {...sw} width={16} height={16}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}
function CashIcon() {
  return (
    <svg {...sw} width={16} height={16}>
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <circle cx="12" cy="12" r="2.2" />
    </svg>
  );
}
function WalletIcon() {
  return (
    <svg {...sw} width={16} height={16}>
      <path d="M3 8a2 2 0 0 1 2-2h12v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
      <path d="M17 11h3v3h-3a1.5 1.5 0 0 1 0-3Z" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg
      className="animate-spin"
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
