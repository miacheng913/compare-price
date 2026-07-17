"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Category = { id: number; name: string };
type Store = { id: number; name: string; color: string };
type Product = {
  id: number;
  name: string;
  brand: string;
  unit: string;
  categoryId: number | null;
  group: string;
  createdAt: string;
};
type PriceRecord = {
  id: number;
  productId: number;
  storeId: number;
  price: number;
  quantity: number;
  date: string;
  notes: string;
  createdAt: string;
};
type AppData = {
  counters: { categories: number; stores: number; products: number; prices: number };
  categories: Category[];
  stores: Store[];
  products: Product[];
  prices: PriceRecord[];
};
type View = "home" | "price" | "product" | "manage" | "detail";

const STORAGE_KEY = "pretty-price-helper-v1";
const today = () => new Date().toISOString().slice(0, 10);
const money = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 });

const initialData: AppData = {
  counters: { categories: 6, stores: 5, products: 0, prices: 0 },
  categories: [
    { id: 1, name: "日用品" },
    { id: 2, name: "食品" },
    { id: 3, name: "飲料" },
    { id: 4, name: "清潔用品" },
    { id: 5, name: "個人護理" },
    { id: 6, name: "其他" },
  ],
  stores: [
    { id: 1, name: "全聯", color: "#ef5b5b" },
    { id: 2, name: "家樂福", color: "#3f7ee8" },
    { id: 3, name: "大潤發", color: "#42a878" },
    { id: 4, name: "Costco", color: "#e3a62f" },
    { id: 5, name: "頂好", color: "#8b67bf" },
  ],
  products: [],
  prices: [],
};

function cloneInitialData(): AppData {
  return JSON.parse(JSON.stringify(initialData));
}

function latestPrices(records: PriceRecord[]) {
  const latest = new Map<number, PriceRecord>();
  records.forEach((record) => {
    const current = latest.get(record.storeId);
    if (!current || record.date > current.date || (record.date === current.date && record.id > current.id)) {
      latest.set(record.storeId, record);
    }
  });
  return [...latest.values()].sort((a, b) => a.price / a.quantity - b.price / b.quantity);
}

function unitPrice(record: PriceRecord) {
  return record.price / record.quantity;
}

function calculateExpression(input: string): number | null {
  const expression = input.replace(/[×xX]/g, "*").replace(/÷/g, "/").replace(/\s/g, "");
  if (!expression || !/^[0-9.+\-*/()]+$/.test(expression)) return null;
  let position = 0;

  function parseFactor(): number {
    if (expression[position] === "+") { position += 1; return parseFactor(); }
    if (expression[position] === "-") { position += 1; return -parseFactor(); }
    if (expression[position] === "(") {
      position += 1;
      const value = parseSum();
      if (expression[position] !== ")") return Number.NaN;
      position += 1;
      return value;
    }
    const start = position;
    while (/[0-9.]/.test(expression[position] || "")) position += 1;
    if (start === position) return Number.NaN;
    return Number(expression.slice(start, position));
  }

  function parseProduct(): number {
    let value = parseFactor();
    while (expression[position] === "*" || expression[position] === "/") {
      const operator = expression[position++];
      const next = parseFactor();
      value = operator === "*" ? value * next : value / next;
    }
    return value;
  }

  function parseSum(): number {
    let value = parseProduct();
    while (expression[position] === "+" || expression[position] === "-") {
      const operator = expression[position++];
      const next = parseProduct();
      value = operator === "+" ? value + next : value - next;
    }
    return value;
  }

  const result = parseSum();
  return position === expression.length && Number.isFinite(result) && result > 0 ? result : null;
}

export default function PriceHelper() {
  const [data, setData] = useState<AppData>(cloneInitialData);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("home");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setData(JSON.parse(saved));
    } catch {
      setData(cloneInitialData());
    }
    const isDark = localStorage.getItem("price-helper-theme") === "dark" ||
      (!localStorage.getItem("price-helper-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark);
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    if (ready) localStorage.setItem("price-helper-theme", dark ? "dark" : "light");
  }, [dark, ready]);

  function updateData(next: AppData) {
    setData(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function navigate(next: View, productId: number | null = null) {
    setView(next);
    setSelectedProductId(productId);
    if (next !== "product") setEditingProductId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openProductForm(productId: number | null = null) {
    setEditingProductId(productId);
    setView("product");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!ready) {
    return <div className="loading-screen"><div className="loading-mark">比</div><p>正在整理你的比價清單…</p></div>;
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="phone-canvas">
        {view === "home" && <HomeView data={data} onOpen={(id) => navigate("detail", id)} onAdd={() => openProductForm()} />}
        {view === "price" && <PriceForm data={data} presetProductId={selectedProductId} onSave={(record) => {
          const next = { ...data, prices: [...data.prices, record], counters: { ...data.counters, prices: record.id } };
          updateData(next);
          notify("價格已記下來");
          navigate("home");
        }} onAddProduct={() => openProductForm()} />}
        {view === "product" && <ProductForm data={data} editingId={editingProductId} onCancel={() => navigate(editingProductId ? "detail" : "home", editingProductId)} onSave={(product) => {
          const exists = data.products.some((item) => item.id === product.id);
          const products = exists ? data.products.map((item) => item.id === product.id ? product : item) : [...data.products, product];
          updateData({ ...data, products, counters: { ...data.counters, products: Math.max(data.counters.products, product.id) } });
          notify(exists ? "商品已更新" : "商品已新增");
          navigate(exists ? "detail" : "home", exists ? product.id : null);
        }} />}
        {view === "manage" && <ManageView data={data} dark={dark} setDark={setDark} updateData={updateData} notify={notify} />}
        {view === "detail" && selectedProductId && <ProductDetail data={data} productId={selectedProductId} onBack={() => navigate("home")} onAddPrice={() => navigate("price", selectedProductId)} onEdit={() => openProductForm(selectedProductId)} onDeleteProduct={() => {
          const next = { ...data, products: data.products.filter((item) => item.id !== selectedProductId), prices: data.prices.filter((item) => item.productId !== selectedProductId) };
          updateData(next);
          notify("商品已刪除");
          navigate("home");
        }} onDeletePrice={(id) => {
          updateData({ ...data, prices: data.prices.filter((item) => item.id !== id) });
          notify("紀錄已刪除");
        }} />}
        {view !== "detail" && <BottomNav view={view} navigate={navigate} openProductForm={openProductForm} />}
      </section>
      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </main>
  );
}

function Header({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: React.ReactNode }) {
  return <header className="topbar"><div><p className="eyebrow">{eyebrow || "買得聰明，也買得漂亮"}</p><h1>{title}</h1></div>{action}</header>;
}

function HomeView({ data, onOpen, onAdd }: { data: AppData; onOpen: (id: number) => void; onAdd: () => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<number | null>(null);
  const products = useMemo(() => data.products.filter((product) => {
    const text = `${product.name} ${product.brand} ${product.group}`.toLowerCase();
    return (!category || product.categoryId === category) && (!query.trim() || text.includes(query.toLowerCase()));
  }), [data.products, category, query]);
  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    products.forEach((product) => {
      const key = product.group.trim() || "其他商品";
      map.set(key, [...(map.get(key) || []), product]);
    });
    return [...map.entries()].map(([name, items]) => ({ name, items: items.sort((a, b) => {
      const ap = latestPrices(data.prices.filter((record) => record.productId === a.id))[0];
      const bp = latestPrices(data.prices.filter((record) => record.productId === b.id))[0];
      return (ap ? unitPrice(ap) : Infinity) - (bp ? unitPrice(bp) : Infinity);
    }) }));
  }, [products, data.prices]);

  return <>
    <Header title="比價小幫手" action={<div className="brand-orb">$</div>} />
    <section className="hero-card">
      <div><span className="hero-kicker">這次買對了嗎？</span><h2>每一塊錢，都花在更值得的地方。</h2></div>
      <div className="hero-stat"><strong>{data.products.length}</strong><span>項商品</span></div>
    </section>
    <section className="toolbar">
      <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋商品、品牌或品項" aria-label="搜尋商品" /></label>
      <div className="chips" aria-label="商品分類">
        <button className={!category ? "chip active" : "chip"} onClick={() => setCategory(null)}>全部</button>
        {data.categories.map((item) => <button key={item.id} className={category === item.id ? "chip active" : "chip"} onClick={() => setCategory(item.id)}>{item.name}</button>)}
      </div>
    </section>
    <section className="content-stack">
      {grouped.length === 0 ? <EmptyState onAdd={onAdd} /> : grouped.map((group) => <article className="compare-card" key={group.name}>
        <div className="compare-heading"><div><span className="tiny-label">比價群組</span><h3>{group.name}</h3></div><span>{group.items.length} 個品牌</span></div>
        <div className="product-list">{group.items.map((product, index) => {
          const record = latestPrices(data.prices.filter((item) => item.productId === product.id))[0];
          const store = record ? data.stores.find((item) => item.id === record.storeId) : null;
          return <button className="product-row" key={product.id} onClick={() => onOpen(product.id)}>
            <div className="rank" data-first={index === 0 && !!record}>{index + 1}</div>
            <div className="product-copy"><strong>{product.name}</strong><span>{product.brand || "未填品牌"}</span>{record && store ? <span className="deal-meta"><i style={{ background: store.color }} />{store.name} · 整筆 ${money.format(record.price)} / {money.format(record.quantity)} {product.unit}</span> : <span>尚無價格</span>}</div>
            {record ? <div className="price-copy"><strong>${money.format(unitPrice(record))}</strong><span>/ {product.unit}</span></div> : <span className="no-price">記價格</span>}
            <span className="chevron">›</span>
          </button>;
        })}</div>
      </article>)}
    </section>
  </>;
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return <div className="empty-state"><div className="empty-illustration"><span>＋</span></div><h2>建立你的第一張比價卡</h2><p>先新增商品，之後每次逛賣場都能快速記下價格。</p><button className="primary-button" onClick={onAdd}>新增第一個商品</button></div>;
}

function ProductForm({ data, editingId, onSave, onCancel }: { data: AppData; editingId: number | null; onSave: (product: Product) => void; onCancel: () => void }) {
  const commonUnits = ["個", "包", "瓶", "盒", "公斤", "公升"];
  const existing = data.products.find((item) => item.id === editingId);
  const [name, setName] = useState(existing?.name || "");
  const [brand, setBrand] = useState(existing?.brand || "");
  const [group, setGroup] = useState(existing?.group || "");
  const [unit, setUnit] = useState(existing?.unit || "個");
  const [categoryId, setCategoryId] = useState(existing?.categoryId?.toString() || "");

  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    onSave({ id: existing?.id || data.counters.products + 1, name: clean, brand: brand.trim(), group: group.trim(), unit: unit.trim() || "個", categoryId: categoryId ? Number(categoryId) : null, createdAt: existing?.createdAt || new Date().toISOString() });
  }

  return <>
    <Header title={existing ? "編輯商品" : "新增商品"} eyebrow="把常買的東西收進來" action={<button className="text-button" onClick={onCancel}>取消</button>} />
    <form className="form-card" onSubmit={submit}>
      <FormField label="商品名稱" required><input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：三層抽取式衛生紙" /></FormField>
      <FormField label="品牌" hint="選填"><input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="例：舒潔" /></FormField>
      <FormField label="比價群組" hint="相同品項放一起，品牌差異一眼看懂"><input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="例：衛生紙" /></FormField>
      <div className="two-columns">
        <FormField label="計量單位" hint="可快速選擇，也可以自己填寫">
          <div className="unit-quick">{commonUnits.map((item) => <button type="button" key={item} className={unit === item ? "active" : ""} onClick={() => setUnit(item)}>{item}</button>)}</div>
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="自訂單位，例如：捲、組" />
        </FormField>
        <FormField label="分類"><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">不分類</option>{data.categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></FormField>
      </div>
      <button className="primary-button full" type="submit">{existing ? "儲存變更" : "新增商品"}</button>
    </form>
    <Tip>同樣是衛生紙，不同品牌都填入「衛生紙」群組，首頁會自動依單價排序。</Tip>
  </>;
}

function PriceForm({ data, presetProductId, onSave, onAddProduct }: { data: AppData; presetProductId: number | null; onSave: (record: PriceRecord) => void; onAddProduct: () => void }) {
  const [productId, setProductId] = useState(presetProductId?.toString() || "");
  const [storeId, setStoreId] = useState(data.stores[0]?.id.toString() || "");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const product = data.products.find((item) => item.id === Number(productId));
  const parsedQuantity = calculateExpression(quantity);
  const calculated = Number(price) > 0 && parsedQuantity ? Number(price) / parsedQuantity : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!productId || !storeId || !Number(price) || !parsedQuantity) return;
    onSave({ id: data.counters.prices + 1, productId: Number(productId), storeId: Number(storeId), price: Number(price), quantity: parsedQuantity, date, notes: notes.trim(), createdAt: new Date().toISOString() });
  }

  return <>
    <Header title="記錄價格" eyebrow="現在看到的價格，立刻記下來" action={<div className="brand-orb small">＋</div>} />
    {data.products.length === 0 ? <EmptyState onAdd={onAddProduct} /> : <form className="form-card" onSubmit={submit}>
      <FormField label="商品" required><select value={productId} onChange={(e) => setProductId(e.target.value)} required><option value="">選擇商品</option>{data.products.map((item) => <option key={item.id} value={item.id}>{item.brand ? `${item.brand}・` : ""}{item.name}</option>)}</select></FormField>
      <FormField label="賣場" required><div className="store-picker">{data.stores.map((store) => <button type="button" key={store.id} className={Number(storeId) === store.id ? "store-pill active" : "store-pill"} onClick={() => setStoreId(store.id.toString())}><i style={{ background: store.color }} />{store.name}</button>)}</div></FormField>
      <div className="two-columns">
        <FormField label="售價" required><div className="money-input"><span>$</span><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" /></div></FormField>
        <FormField label={`數量（${product?.unit || "單位"}）`} hint="可輸入算式，例如 6×2 或 12÷3" required>
          <input inputMode="text" value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-invalid={quantity.length > 0 && !parsedQuantity} />
          <div className="expression-tools">{["+", "−", "×", "÷"].map((operator) => <button type="button" key={operator} onClick={() => setQuantity((value) => `${value}${operator === "−" ? "-" : operator}`)}>{operator}</button>)}<button type="button" onClick={() => setQuantity((value) => value.slice(0, -1))}>⌫</button></div>
          {parsedQuantity && /[+\-×xX*÷/]/.test(quantity) && <span className="expression-result">= {money.format(parsedQuantity)} {product?.unit || "單位"}</span>}
        </FormField>
      </div>
      {calculated !== null && <div className="calculation"><span>換算單價</span><strong>${money.format(calculated)} <small>/ {product?.unit || "單位"}</small></strong></div>}
      <div className="two-columns">
        <FormField label="日期"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
        <FormField label="備註" hint="選填"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="特價、會員價" /></FormField>
      </div>
      <button className="primary-button full" type="submit">記下這筆價格</button>
    </form>}
  </>;
}

function ProductDetail({ data, productId, onBack, onAddPrice, onEdit, onDeleteProduct, onDeletePrice }: { data: AppData; productId: number; onBack: () => void; onAddPrice: () => void; onEdit: () => void; onDeleteProduct: () => void; onDeletePrice: (id: number) => void }) {
  const product = data.products.find((item) => item.id === productId);
  const [menu, setMenu] = useState(false);
  if (!product) return null;
  const records = data.prices.filter((item) => item.productId === productId).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const latest = latestPrices(records);
  const category = data.categories.find((item) => item.id === product.categoryId);
  return <>
    <header className="detail-topbar"><button className="round-button" onClick={onBack} aria-label="返回">‹</button><div className="detail-actions"><button className="secondary-button compact" onClick={onAddPrice}>＋ 記價格</button><button className="round-button" onClick={() => setMenu(!menu)} aria-label="更多選項">•••</button></div>{menu && <div className="pop-menu"><button onClick={onEdit}>編輯商品</button><button className="danger" onClick={() => confirm(`確定刪除「${product.name}」及所有價格紀錄？`) && onDeleteProduct()}>刪除商品</button></div>}</header>
    <section className="product-hero"><p>{category?.name || "未分類"} · {product.group || "一般商品"}</p><h1>{product.name}</h1><span>{product.brand || "未填品牌"}</span></section>
    <section className="content-stack detail-stack">
      <article className="compare-card"><div className="compare-heading"><div><span className="tiny-label">最新情報</span><h3>各賣場單價</h3></div><span>每 {product.unit}</span></div>
        {latest.length ? <div className="store-price-list">{latest.map((record, index) => { const store = data.stores.find((item) => item.id === record.storeId); return <div className="store-price-row" key={record.id}><i style={{ background: store?.color }} /><div><strong>{store?.name || "未知賣場"}</strong><span>{record.date}</span></div><div className="price-copy"><strong className={index === 0 ? "best" : ""}>${money.format(unitPrice(record))}</strong><span>/ {product.unit}</span></div>{index === 0 && <b className="best-tag">最低</b>}</div>; })}</div> : <div className="inline-empty">還沒有價格，去記下第一筆吧。</div>}
      </article>
      <article className="history-card"><div className="section-title"><div><span className="tiny-label">完整紀錄</span><h3>價格歷史</h3></div><strong>{records.length} 筆</strong></div>
        {records.length ? <div className="history-list">{records.map((record) => { const store = data.stores.find((item) => item.id === record.storeId); return <div className="history-row" key={record.id}><div className="history-date"><strong>{record.date.slice(8)}</strong><span>{record.date.slice(0, 7)}</span></div><i style={{ background: store?.color }} /><div className="history-copy"><strong>{store?.name || "未知賣場"}</strong><span>{record.notes || `${record.quantity} ${product.unit}`}</span></div><div className="history-price"><strong>${money.format(record.price)}</strong><span>${money.format(unitPrice(record))}/{product.unit}</span></div><button onClick={() => confirm("確定刪除這筆紀錄？") && onDeletePrice(record.id)} aria-label="刪除紀錄">×</button></div>; })}</div> : <div className="inline-empty">尚無價格歷史。</div>}
      </article>
    </section>
  </>;
}

function ManageView({ data, dark, setDark, updateData, notify }: { data: AppData; dark: boolean; setDark: (value: boolean) => void; updateData: (data: AppData) => void; notify: (message: string) => void }) {
  const [storeName, setStoreName] = useState("");
  const [storeColor, setStoreColor] = useState("#8b67bf");
  const [categoryName, setCategoryName] = useState("");

  function addStore(event: FormEvent) {
    event.preventDefault(); const name = storeName.trim(); if (!name || data.stores.some((item) => item.name === name)) return;
    const id = data.counters.stores + 1; updateData({ ...data, stores: [...data.stores, { id, name, color: storeColor }], counters: { ...data.counters, stores: id } }); setStoreName(""); notify("賣場已新增");
  }
  function addCategory(event: FormEvent) {
    event.preventDefault(); const name = categoryName.trim(); if (!name || data.categories.some((item) => item.name === name)) return;
    const id = data.counters.categories + 1; updateData({ ...data, categories: [...data.categories, { id, name }], counters: { ...data.counters, categories: id } }); setCategoryName(""); notify("分類已新增");
  }
  return <>
    <Header title="管理設定" eyebrow="把常用選項整理成你的樣子" action={<div className="brand-orb small">⚙</div>} />
    <section className="content-stack manage-stack">
      <article className="settings-card"><div><span className="tiny-label">外觀</span><h3>深色模式</h3><p>夜晚逛賣場也不刺眼</p></div><button className={dark ? "toggle on" : "toggle"} onClick={() => setDark(!dark)} aria-label="切換深色模式"><span /></button></article>
      <article className="manage-card"><div className="section-title"><div><span className="tiny-label">購物地圖</span><h3>賣場</h3></div><strong>{data.stores.length} 家</strong></div><div className="token-list">{data.stores.map((store) => <div className="manage-token" key={store.id}><input className="color-editor" type="color" value={store.color} aria-label={`編輯 ${store.name} 的顏色`} onChange={(event) => updateData({ ...data, stores: data.stores.map((item) => item.id === store.id ? { ...item, color: event.target.value } : item) })} /><span>{store.name}</span><button onClick={() => { const name = prompt("編輯賣場名稱", store.name)?.trim(); if (name) updateData({ ...data, stores: data.stores.map((item) => item.id === store.id ? { ...item, name } : item) }); }}>改名</button><button className="danger" onClick={() => confirm(`刪除「${store.name}」及相關價格？`) && updateData({ ...data, stores: data.stores.filter((item) => item.id !== store.id), prices: data.prices.filter((item) => item.storeId !== store.id) })}>刪除</button></div>)}</div><form className="inline-form" onSubmit={addStore}><input type="color" value={storeColor} onChange={(e) => setStoreColor(e.target.value)} aria-label="賣場顏色" /><input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="新增賣場名稱" /><button>＋ 新增</button></form></article>
      <article className="manage-card"><div className="section-title"><div><span className="tiny-label">快速篩選</span><h3>分類</h3></div><strong>{data.categories.length} 個</strong></div><div className="token-list">{data.categories.map((category) => <div className="manage-token" key={category.id}><span>{category.name}</span><button onClick={() => { const name = prompt("編輯分類名稱", category.name)?.trim(); if (name) updateData({ ...data, categories: data.categories.map((item) => item.id === category.id ? { ...item, name } : item) }); }}>編輯</button><button className="danger" onClick={() => confirm(`確定刪除「${category.name}」分類？`) && updateData({ ...data, categories: data.categories.filter((item) => item.id !== category.id), products: data.products.map((item) => item.categoryId === category.id ? { ...item, categoryId: null } : item) })}>刪除</button></div>)}</div><form className="inline-form" onSubmit={addCategory}><input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="新增分類名稱" /><button>＋ 新增</button></form></article>
      <Tip>資料只會儲存在目前這台裝置的瀏覽器中，不會上傳到任何伺服器。</Tip>
    </section>
  </>;
}

function FormField({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return <label className="form-field"><span>{label}{required && <b> *</b>}{hint && <small>{hint}</small>}</span>{children}</label>;
}

function Tip({ children }: { children: React.ReactNode }) {
  return <div className="tip"><span>i</span><p>{children}</p></div>;
}

function BottomNav({ view, navigate, openProductForm }: { view: View; navigate: (view: View) => void; openProductForm: () => void }) {
  const items: { view: View; icon: string; label: string; action?: () => void }[] = [
    { view: "home", icon: "⌂", label: "商品" },
    { view: "price", icon: "+", label: "記價格" },
    { view: "product", icon: "□", label: "新商品", action: openProductForm },
    { view: "manage", icon: "⚙", label: "管理" },
  ];
  return <nav className="bottom-nav" aria-label="主要導覽">{items.map((item) => <button key={item.view} className={view === item.view ? "active" : ""} onClick={() => item.action ? item.action() : navigate(item.view)}><span>{item.icon}</span><b>{item.label}</b></button>)}</nav>;
}
