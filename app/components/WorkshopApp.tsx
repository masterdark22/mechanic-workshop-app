"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultHistory, defaultInventory, defaultRoutes, defaultServices } from "@/lib/mock-data";
import { safeReadStorage, safeWriteStorage } from "@/lib/storage";
import type { CartItem, HistoryEntry, InventoryCategory, InventoryItem, Notification, RouteRecord, ServiceItem } from "@/lib/types";

const tabs = [
  { id: "cobrar", label: "Cobrar / Cotizar" },
  { id: "servicios", label: "Servicios" },
  { id: "inventario", label: "Inventario y Catálogo" },
  { id: "historial", label: "Historial por Ruta" },
] as const;

const inventoryCategoryKeywords: Array<{ keyword: string; category: InventoryCategory }> = [
  { keyword: "filtro", category: "Filtros" },
  { keyword: "neumatico", category: "Neumáticos" },
  { keyword: "llanta", category: "Neumáticos" },
  { keyword: "freno", category: "Frenos" },
  { keyword: "pastilla", category: "Frenos" },
  { keyword: "motor", category: "Mecánica" },
  { keyword: "bomba", category: "Mecánica" },
  { keyword: "electrico", category: "Eléctrico" },
  { keyword: "cable", category: "Eléctrico" },
  { keyword: "servicio", category: "Servicio" },
];

const inferInventoryCategory = (name: string): InventoryCategory => {
  const normalized = name.trim().toLowerCase();

  if (!normalized) {
    return "Filtros";
  }

  const inferred = inventoryCategoryKeywords.find(({ keyword }) => normalized.includes(keyword));
  return inferred?.category ?? "Filtros";
};

type TabId = (typeof tabs)[number]["id"];

const baseInventoryCategories: InventoryCategory[] = [
  "Filtros",
  "Mecánica",
  "Neumáticos",
  "Frenos",
  "Eléctrico",
  "Servicio",
];

type InventoryFormState = {
  id: string;
  name: string;
  category: InventoryCategory;
  price: string;
  stock: string;
};

type RouteFormState = {
  id: string;
  name: string;
  unit: string;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);

const normalizeRouteName = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return /^ruta\s+/i.test(trimmed) ? trimmed : `Ruta ${trimmed}`;
};

const buildTicketText = (route: string, items: CartItem[], total: number) => {
  const lines = [
    "*Taller Móvil - Cotización*",
    `Ruta/Unidad: ${route || "Sin dato"}`,
    "",
    ...items.map((item) => `${item.name} x${item.quantity} - ${formatMoney(item.price * item.quantity)}`),
    "",
    `*Total: ${formatMoney(total)}*`,
    "",
    "Gracias por tu confianza.",
  ];

  return lines.join("\n");
};

const emptyInventoryForm = (): InventoryFormState => ({
  id: "",
  name: "",
  category: "Filtros",
  price: "",
  stock: "",
});

const emptyRouteForm = (): RouteFormState => ({
  id: "",
  name: "",
  unit: "",
});

type ServiceFormState = {
  id: string;
  name: string;
  price: string;
};

const emptyServiceForm = (): ServiceFormState => ({
  id: "",
  name: "",
  price: "",
});

export function WorkshopApp() {
  const [activeTab, setActiveTab] = useState<TabId>("cobrar");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [routeInput, setRouteInput] = useState("");
  const [truckUnit, setTruckUnit] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryCategory, setInventoryCategory] = useState("Todos");
  const [selectedRouteSearch, setSelectedRouteSearch] = useState("");
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [todayLabel, setTodayLabel] = useState("Hoy");
  const [inventoryForm, setInventoryForm] = useState<InventoryFormState>(emptyInventoryForm());
  const [routeForm, setRouteForm] = useState<RouteFormState>(emptyRouteForm());
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(emptyServiceForm());
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showInventoryCatalog, setShowInventoryCatalog] = useState(true);
  const [showServicesCatalog, setShowServicesCatalog] = useState(false);
  const [selectedRouteKey, setSelectedRouteKey] = useState<string | null>(null);

  useEffect(() => {
    setTodayLabel(
      new Intl.DateTimeFormat("es-MX", {
        day: "2-digit",
        month: "short",
      }).format(new Date()),
    );
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      ["inventory", "services", "history", "routes"].forEach((key) => {
        window.localStorage.removeItem(`taller-movil:${key}`);
      });
    }

    setInventory(defaultInventory);
    setServices(defaultServices);
    setHistory(defaultHistory);
    setRoutes(defaultRoutes);
    setRouteInput("");
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    safeWriteStorage("inventory", inventory);
  }, [inventory, isReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    safeWriteStorage("services", services);
  }, [services, isReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    safeWriteStorage("history", history);
  }, [history, isReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    safeWriteStorage("routes", routes);
  }, [routes, isReady]);

  const categories = useMemo(
    () => ["Todos", ...new Set([...baseInventoryCategories, ...inventory.map((item) => item.category)])],
    [inventory],
  );

  const filteredInventory = useMemo(() => {
    const term = inventorySearch.trim().toLowerCase();

    return inventory.filter((item) => {
      const matchesCategory = inventoryCategory === "Todos" || item.category === inventoryCategory;
      const matchesSearch =
        term.length === 0 || item.name.toLowerCase().includes(term) || item.category.toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [inventory, inventoryCategory, inventorySearch]);

  const groupedHistory = useMemo(() => {
    const map = new Map<string, { key: string; route: string; units: string[]; entries: HistoryEntry[]; latestDate: string }>();

    history.forEach((entry) => {
      const routeName = normalizeRouteName(entry.route || "Sin ruta");
      const routeKey = routeName.toLowerCase();
      const existing = map.get(routeKey);

      if (existing) {
        existing.entries.push(entry);
        if (!existing.units.includes(entry.unit)) {
          existing.units.push(entry.unit);
        }
        existing.latestDate = new Date(entry.date).getTime() > new Date(existing.latestDate).getTime() ? entry.date : existing.latestDate;
        return;
      }

      map.set(routeKey, {
        key: routeKey,
        route: routeName,
        units: [entry.unit],
        entries: [entry],
        latestDate: entry.date,
      });
    });

    return [...map.values()].sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());
  }, [history]);

  const filteredHistory = useMemo(() => {
    return groupedHistory;
  }, [groupedHistory]);

  const selectedRouteGroup = filteredHistory.find((group) => group.key === selectedRouteKey) ?? filteredHistory[0] ?? null;

  useEffect(() => {
    if (filteredHistory.length > 0 && !selectedRouteKey) {
      setSelectedRouteKey(filteredHistory[0].key);
    }
  }, [filteredHistory, selectedRouteKey]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );

  const cartQuantity = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const addToCart = (item: InventoryItem) => {
    setNotification(null);
    setCart((current) => {
      const existing = current.find((entry) => entry.id === item.id);

      if (existing) {
        return current.map((entry) =>
          entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
        );
      }

      return [
        ...current,
        {
          id: item.id,
          name: item.name,
          category: item.category,
          price: item.price,
          quantity: 1,
        },
      ];
    });
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart((current) =>
      current
        .map((item) =>
          item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const handleSaveInventory = () => {
    const trimmedName = inventoryForm.name.trim();
    const parsedPrice = Number(inventoryForm.price);
    const parsedStock = Number(inventoryForm.stock);
    const resolvedCategory = inferInventoryCategory(trimmedName);

    if (!trimmedName || Number.isNaN(parsedPrice) || Number.isNaN(parsedStock) || parsedPrice < 0 || parsedStock < 0) {
      setNotification({ type: "error", message: "Completa nombre, precio y stock válidos para guardar la pieza." });
      return;
    }

    if (inventoryForm.id) {
      setInventory((current) =>
        current.map((item) =>
          item.id === inventoryForm.id
            ? {
                ...item,
                name: trimmedName,
                category: resolvedCategory,
                price: parsedPrice,
                stock: parsedStock,
              }
            : item,
        ),
      );
      setNotification({ type: "success", message: "Pieza actualizada correctamente." });
    } else {
      const newItem: InventoryItem = {
        id: `item-${Date.now()}`,
        name: trimmedName,
        category: resolvedCategory,
        price: parsedPrice,
        stock: parsedStock,
      };

      setInventory((current) => [newItem, ...current]);
      setNotification({ type: "success", message: "Nueva pieza agregada al catálogo." });
    }

    setInventoryForm(emptyInventoryForm());
    setShowInventoryForm(false);
  };

  const handleDeleteInventory = (id: string) => {
    setInventory((current) => current.filter((item) => item.id !== id));
    setNotification({ type: "success", message: "Pieza eliminada del inventario." });
  };

  const handleSaveRoute = () => {
    const rawName = routeForm.name.trim();
    const cleanedUnit = routeForm.unit.trim();

    if (!rawName) {
      setNotification({ type: "error", message: "Escribe el número de la ruta." });
      return;
    }

    const normalizedName = rawName.toLowerCase().startsWith("ruta ") ? rawName : `Ruta ${rawName}`;

    if (routeForm.id) {
      setRoutes((current) =>
        current.map((route) =>
          route.id === routeForm.id ? { ...route, name: normalizedName, unit: cleanedUnit } : route,
        ),
      );
      setNotification({ type: "success", message: "Ruta actualizada correctamente." });
    } else {
      const nextRoute: RouteRecord = {
        id: `route-${Date.now()}`,
        name: normalizedName,
        unit: cleanedUnit,
      };
      setRoutes((current) => [nextRoute, ...current]);
      setNotification({ type: "success", message: "Ruta agregada al sistema." });
    }

    setRouteForm(emptyRouteForm());
    setShowRouteForm(false);
  };

  const handleDeleteRoute = (id: string) => {
    setRoutes((current) => current.filter((route) => route.id !== id));
    setNotification({ type: "success", message: "Ruta eliminada." });
  };

  const handleSaveService = () => {
    const cleanedName = serviceForm.name.trim();
    const parsedPrice = Number(serviceForm.price);

    if (!cleanedName || Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setNotification({ type: "error", message: "Escribe un nombre y precio válido para guardar el servicio." });
      return;
    }

    if (serviceForm.id) {
      setServices((current) =>
        current.map((service) =>
          service.id === serviceForm.id ? { ...service, name: cleanedName, price: parsedPrice } : service,
        ),
      );
      setNotification({ type: "success", message: "Servicio actualizado correctamente." });
    } else {
      const nextService: ServiceItem = {
        id: `service-${Date.now()}`,
        name: cleanedName,
        price: parsedPrice,
      };

      setServices((current) => [nextService, ...current]);
      setNotification({ type: "success", message: "Servicio agregado al catálogo." });
    }

    setServiceForm(emptyServiceForm());
    setShowServiceForm(false);
  };

  const handleDeleteService = (id: string) => {
    setServices((current) => current.filter((service) => service.id !== id));
    setNotification({ type: "success", message: "Servicio eliminado." });
  };

  const handleConfirmService = () => {
    const routeName = normalizeRouteName(routeInput);

    if (!routeName) {
      setNotification({ type: "error", message: "Escribe la ruta antes de guardar el registro." });
      return;
    }

    if (cart.length === 0) {
      setNotification({ type: "error", message: "Agrega al menos una pieza o servicio al registro." });
      return;
    }

    const stockIssue = cart.find((entry) => {
      if (entry.category === "Servicio") {
        return false;
      }

      const stockItem = inventory.find((item) => item.id === entry.id);
      return (stockItem?.stock ?? 0) < entry.quantity;
    });

    if (stockIssue) {
      const stockItem = inventory.find((item) => item.id === stockIssue.id);
      const available = stockItem?.stock ?? 0;
      setNotification({
        type: "error",
        message: `No hay suficiente stock de ${stockIssue.name}. Disponibles: ${available}.`,
      });
      return;
    }

    const updatedInventory = inventory.map((item) => {
      const selected = cart.find((entry) => entry.id === item.id);
      if (!selected) {
        return item;
      }

      return { ...item, stock: item.stock - selected.quantity };
    });

    const matchingRoute = routes.find((route) => route.name.toLowerCase() === routeName.toLowerCase());
    const routeUnit = truckUnit.trim() || matchingRoute?.unit || "Sin unidad";
    const newEntry: HistoryEntry = {
      id: `svc-${Date.now()}`,
      route: routeName,
      date: new Date().toISOString(),
      unit: routeUnit,
      items: cart,
      total: cartTotal,
    };

    setInventory(updatedInventory);
    setHistory((current) => [newEntry, ...current]);
    setCart([]);
    setRouteInput("");
    setTruckUnit("");
    setNotification({
      type: "success",
      message: `Registro guardado para ${routeName}. El inventario se descontó correctamente.`,
    });
  };

  const addServiceToCart = (service: ServiceItem) => {
    setNotification(null);
    setCart((current) => [
      ...current,
      {
        id: service.id,
        name: service.name,
        category: "Servicio",
        price: service.price,
        quantity: 1,
      },
    ]);
  };

  return (
    <main className="min-h-screen bg-[#071822] text-white">
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <header className="rounded-3xl border border-amber-500/40 bg-[#0e1b2a] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Taller móvil</p>
              <h1 className="mt-1 text-2xl font-black text-white md:text-3xl">Control rápido de cobros y stock</h1>
            </div>
            <div className="rounded-full border border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200">
              {todayLabel}
            </div>
          </div>
        </header>

        {notification && (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
              notification.type === "success"
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/50 bg-red-500/10 text-red-200"
            }`}
          >
            {notification.message}
          </div>
        )}

        <nav className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-3">
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[56px] rounded-2xl border px-4 py-3 text-left text-base font-bold transition ${
                  selected
                    ? "border-amber-300 bg-amber-400 text-[#071822] shadow-lg shadow-amber-500/20"
                    : "border-slate-700 bg-slate-900/60 text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {activeTab === "cobrar" && (
          <section className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div className="rounded-3xl border border-slate-700 bg-[#0d1a26] p-4">
                <div className="space-y-3">
                  <div>
                    <label htmlFor="route-input" className="mb-2 block text-sm font-semibold text-slate-200">
                      Ruta atendida
                    </label>
                    <input
                      id="route-input"
                      value={routeInput}
                      onChange={(event) => setRouteInput(event.target.value)}
                      className="min-h-[52px] w-full rounded-2xl border border-slate-600 bg-slate-950/70 px-4 text-base text-white outline-none ring-0 placeholder:text-slate-400 focus:border-amber-300"
                      placeholder="Ej. 15"
                    />
                  </div>

                  <div>
                    <label htmlFor="truck-unit" className="mb-2 block text-sm font-semibold text-slate-200">
                      Unidad del camión
                    </label>
                    <input
                      id="truck-unit"
                      value={truckUnit}
                      onChange={(event) => setTruckUnit(event.target.value)}
                      className="min-h-[52px] w-full rounded-2xl border border-slate-600 bg-slate-950/70 px-4 text-base text-white outline-none ring-0 placeholder:text-slate-400 focus:border-amber-300"
                      placeholder="Ej. Unidad 20"
                    />
                  </div>
                </div>

                {routes.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {routes.map((route) => (
                      <button
                        key={route.id}
                        type="button"
                        onClick={() => {
                          setRouteInput(route.name.replace(/^Ruta\s+/i, ""));
                          if (route.unit) {
                            setTruckUnit(route.unit);
                          }
                        }}
                        className="rounded-full border border-slate-600 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200"
                      >
                        {route.name} · {route.unit || "Sin unidad"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-slate-700 bg-[#0d1a26] p-4">
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowInventoryCatalog((current) => !current)}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-600 bg-slate-900/70 px-4 py-3 text-left text-base font-black text-white"
                  >
                    <span>Piezas</span>
                    <span className="text-lg">{showInventoryCatalog ? "−" : "+"}</span>
                  </button>

                  {showInventoryCatalog && (
                    filteredInventory.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-950/40 p-5 text-center">
                        <p className="text-base font-bold text-white">Todavía no hay piezas para vender.</p>
                        <button
                          type="button"
                          onClick={() => setActiveTab("inventario")}
                          className="mt-4 min-h-[48px] rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-[#071822]"
                        >
                          Ir a inventario
                        </button>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {filteredInventory.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => addToCart(item)}
                            className="min-h-[88px] rounded-2xl border border-slate-700 bg-slate-900/70 p-3 text-left transition hover:border-amber-300 hover:bg-slate-800"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-base font-bold text-white">{item.name}</p>
                                <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-amber-200">
                                  {item.category}
                                </p>
                              </div>
                              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200">
                                Stock {item.stock}
                              </span>
                            </div>
                            <div className="mt-3 flex items-center justify-between border-t border-slate-700 pt-2">
                              <span className="text-sm text-slate-300">Agregar</span>
                              <span className="text-base font-black text-amber-300">{formatMoney(item.price)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )
                  )}
                </div>

                <div className="mt-4 space-y-3 border-t border-slate-700 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowServicesCatalog((current) => !current)}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-600 bg-slate-900/70 px-4 py-3 text-left text-base font-black text-white"
                  >
                    <span>Servicios</span>
                    <span className="text-lg">{showServicesCatalog ? "−" : "+"}</span>
                  </button>

                  {showServicesCatalog && (
                    services.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-950/40 p-5 text-center text-sm text-slate-300">
                        No hay servicios creados todavía.
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {services.map((service) => (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => addServiceToCart(service)}
                            className="min-h-[88px] rounded-2xl border border-slate-700 bg-slate-900/70 p-3 text-left transition hover:border-amber-300 hover:bg-slate-800"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-base font-bold text-white">{service.name}</p>
                                <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-amber-200">Servicio</p>
                              </div>
                              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-200">
                                {formatMoney(service.price)}
                              </span>
                            </div>
                            <div className="mt-3 flex items-center justify-between border-t border-slate-700 pt-2">
                              <span className="text-sm text-slate-300">Agregar</span>
                              <span className="text-base font-black text-amber-300">Añadir al ticket</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            <aside className="rounded-3xl border border-slate-700 bg-[#0d1a26] p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white">Ticket</h2>
                <span className="rounded-full bg-amber-400/15 px-3 py-1 text-sm font-bold text-amber-200">
                  {cartQuantity} piezas
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {cart.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-950/40 p-5 text-center text-sm text-slate-300">
                    Aún no hay piezas agregadas.
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-700 bg-slate-950/50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-bold text-white">{item.name}</p>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.category}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.id, -item.quantity)}
                          className="text-sm font-semibold text-red-300"
                        >
                          Quitar
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.id, -1)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-600 bg-slate-900 text-xl text-white"
                            aria-label={`Disminuir cantidad de ${item.name}`}
                          >
                            −
                          </button>
                          <span className="min-w-[32px] text-center text-lg font-black text-white">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.id, 1)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-600 bg-slate-900 text-xl text-white"
                            aria-label={`Aumentar cantidad de ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                        <span className="text-base font-black text-amber-300">
                          {formatMoney(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-5 border-t border-slate-700 pt-4">
                <div className="flex items-center justify-between text-lg font-bold text-slate-100">
                  <span>Total</span>
                  <span className="text-2xl text-amber-300">{formatMoney(cartTotal)}</span>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  onClick={handleConfirmService}
                  className="min-h-[56px] rounded-2xl bg-amber-400 px-4 py-3 text-base font-black text-[#071822] transition hover:bg-amber-300"
                >
                  Guardar registro
                </button>
              </div>
            </aside>
          </section>
        )}

        {activeTab === "servicios" && (
          <section className="mt-5 rounded-3xl border border-slate-700 bg-[#0d1a26] p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-left">
                <h2 className="text-xl font-black text-white">Servicios personalizados</h2>
                <p className="text-sm text-slate-300">Crea servicios y precios que tu papá use en cada atención.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowServiceForm(true);
                  setServiceForm(emptyServiceForm());
                }}
                className="min-h-[52px] rounded-2xl bg-amber-400 px-4 py-3 text-base font-black text-[#071822]"
              >
                + Agregar servicio
              </button>
            </div>

            {showServiceForm && (
              <div className="mb-5 rounded-2xl border border-slate-700 bg-slate-950/40 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={serviceForm.name}
                    onChange={(event) => setServiceForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Nombre del servicio"
                    className="min-h-[52px] rounded-2xl border border-slate-600 bg-slate-950/70 px-4 text-base text-white outline-none focus:border-amber-300"
                  />
                  <input
                    type="number"
                    min="0"
                    value={serviceForm.price}
                    onChange={(event) => setServiceForm((current) => ({ ...current, price: event.target.value }))}
                    placeholder="Precio"
                    className="min-h-[52px] rounded-2xl border border-slate-600 bg-slate-950/70 px-4 text-base text-white outline-none focus:border-amber-300"
                  />
                </div>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={handleSaveService}
                    className="min-h-[52px] rounded-2xl bg-emerald-500 px-4 py-3 font-black text-[#071822]"
                  >
                    Guardar servicio
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowServiceForm(false);
                      setServiceForm(emptyServiceForm());
                    }}
                    className="min-h-[52px] rounded-2xl border border-slate-600 bg-slate-900 px-4 py-3 font-semibold text-white"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {services.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-950/40 p-5 text-center text-sm text-slate-300 md:col-span-2 xl:col-span-3">
                  Todavía no hay servicios personalizados. Agrega uno desde aquí.
                </div>
              ) : (
                services.map((service) => (
                  <div key={service.id} className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-white">{service.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-amber-200">Servicio</p>
                      </div>
                      <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-200">
                        {formatMoney(service.price)}
                      </span>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setServiceForm({ id: service.id, name: service.name, price: String(service.price) });
                          setShowServiceForm(true);
                        }}
                        className="flex-1 min-h-[48px] rounded-xl border border-amber-500 bg-amber-500/10 px-3 py-2 text-sm font-black text-amber-200"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteService(service.id)}
                        className="flex-1 min-h-[48px] rounded-xl border border-red-500 bg-red-500/10 px-3 py-2 text-sm font-black text-red-200"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {activeTab === "inventario" && (
          <section className="mt-5 rounded-3xl border border-slate-700 bg-[#0d1a26] p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid flex-1 gap-3 md:grid-cols-[1.2fr_0.8fr]">
                <input
                  value={inventorySearch}
                  onChange={(event) => setInventorySearch(event.target.value)}
                  placeholder="Buscar por pieza o categoría"
                  className="min-h-[52px] rounded-2xl border border-slate-600 bg-slate-950/70 px-4 text-base text-white outline-none focus:border-amber-300"
                />
                <select
                  value={inventoryCategory}
                  onChange={(event) => setInventoryCategory(event.target.value)}
                  className="min-h-[52px] rounded-2xl border border-slate-600 bg-slate-950/70 px-4 text-base text-white outline-none focus:border-amber-300"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowInventoryForm(true);
                  setInventoryForm(emptyInventoryForm());
                }}
                className="min-h-[52px] rounded-2xl bg-amber-400 px-4 py-3 text-base font-black text-[#071822]"
              >
                + Agregar pieza
              </button>
            </div>

            {showInventoryForm && (
              <div className="mb-5 rounded-2xl border border-slate-700 bg-slate-950/40 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={inventoryForm.name}
                    onChange={(event) => {
                      const nextName = event.target.value;
                      const inferred = inferInventoryCategory(nextName);
                      setInventoryForm((current) => ({ ...current, name: nextName, category: inferred }));
                    }}
                    placeholder="Nombre de la pieza"
                    className="min-h-[52px] rounded-2xl border border-slate-600 bg-slate-950/70 px-4 text-base text-white"
                  />
                  <select
                    value={inventoryForm.category}
                    onChange={(event) =>
                      setInventoryForm((current) => ({ ...current, category: event.target.value as InventoryCategory }))
                    }
                    className="min-h-[52px] rounded-2xl border border-slate-600 bg-slate-950/70 px-4 text-base text-white"
                  >
                    {baseInventoryCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={inventoryForm.price}
                    onChange={(event) => setInventoryForm((current) => ({ ...current, price: event.target.value }))}
                    placeholder="Precio"
                    className="min-h-[52px] rounded-2xl border border-slate-600 bg-slate-950/70 px-4 text-base text-white"
                  />
                  <input
                    type="number"
                    min="0"
                    value={inventoryForm.stock}
                    onChange={(event) => setInventoryForm((current) => ({ ...current, stock: event.target.value }))}
                    placeholder="Stock"
                    className="min-h-[52px] rounded-2xl border border-slate-600 bg-slate-950/70 px-4 text-base text-white"
                  />
                </div>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={handleSaveInventory}
                    className="min-h-[52px] rounded-2xl bg-emerald-500 px-4 py-3 font-black text-[#071822]"
                  >
                    Guardar pieza
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInventoryForm(false);
                      setInventoryForm(emptyInventoryForm());
                    }}
                    className="min-h-[52px] rounded-2xl border border-slate-600 bg-slate-900 px-4 py-3 font-semibold text-white"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredInventory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-950/40 p-5 text-center text-sm text-slate-300 md:col-span-2 xl:col-span-3">
                  <p className="text-base font-bold text-white">No hay piezas en el catálogo.</p>
                  <p className="mt-2">Agrega la primera pieza con el botón de arriba.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInventoryForm(true);
                      setInventoryForm(emptyInventoryForm());
                    }}
                    className="mt-4 min-h-[48px] rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-[#071822]"
                  >
                    Agregar pieza
                  </button>
                </div>
              ) : (
                filteredInventory.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-black text-white">{item.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-amber-200">{item.category}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${item.stock > 3 ? "bg-emerald-500/10 text-emerald-200" : "bg-amber-500/10 text-amber-200"}`}>
                        {item.stock} en stock
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm text-slate-300">Precio</span>
                      <span className="text-xl font-black text-amber-300">{formatMoney(item.price)}</span>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setInventoryForm({
                            id: item.id,
                            name: item.name,
                            category: item.category,
                            price: String(item.price),
                            stock: String(item.stock),
                          });
                          setShowInventoryForm(true);
                        }}
                        className="flex-1 min-h-[48px] rounded-xl border border-amber-500 bg-amber-500/10 px-3 py-2 text-sm font-black text-amber-200"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteInventory(item.id)}
                        className="flex-1 min-h-[48px] rounded-xl border border-red-500 bg-red-500/10 px-3 py-2 text-sm font-black text-red-200"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {activeTab === "historial" && (
          <section className="mt-5 rounded-3xl border border-slate-700 bg-[#0d1a26] p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              {routes.length === 0 ? (
                <div className="w-full rounded-2xl border border-dashed border-slate-600 bg-slate-950/40 p-4 text-sm text-slate-300">
                  No hay rutas creadas aún. Se irán formando según las ventas confirmadas.
                </div>
              ) : (
                routes.map((route) => (
                  <div key={route.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRouteInput(route.name.replace(/^Ruta\s+/i, ""));
                        setActiveTab("cobrar");
                      }}
                      className="rounded-full border border-slate-600 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200"
                    >
                      {route.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRoute(route.id)}
                      className="rounded-full border border-red-500 bg-red-500/10 px-2 py-2 text-xs font-black text-red-200"
                      aria-label={`Eliminar ruta ${route.name}`}
                    >
                      X
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {filteredHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-950/40 p-5 text-center text-sm text-slate-300 lg:col-span-2">
                  <p className="text-base font-bold text-white">No hay historial todavía.</p>
                  <p className="mt-2">Cuando guardes servicios, aparecerán aquí agrupados por ruta.</p>
                </div>
              ) : (
                filteredHistory.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setSelectedRouteKey(group.key)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selectedRouteGroup?.key === group.key
                        ? "border-amber-300 bg-amber-500/10"
                        : "border-slate-700 bg-slate-900/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-white">{group.route}</p>
                        <p className="text-sm text-slate-300">Unidades: {group.units.join(", ") || "Sin unidad"}</p>
                      </div>
                      <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-bold text-slate-200">
                        {group.entries.length} servicio{group.entries.length > 1 ? "s" : ""}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {selectedRouteGroup && (
              <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xl font-black text-white">{selectedRouteGroup.route}</p>
                    <p className="text-sm text-slate-300">Unidades: {selectedRouteGroup.units.join(", ") || "Sin unidad"}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <input
                    value={selectedRouteSearch}
                    onChange={(event) => setSelectedRouteSearch(event.target.value)}
                    placeholder="Buscar servicio o pieza"
                    className="min-h-[52px] w-full rounded-2xl border border-slate-600 bg-slate-950/70 px-4 text-base text-white outline-none focus:border-amber-300"
                  />
                </div>

                <div className="space-y-3">
                  {selectedRouteGroup.entries
                    .filter((entry) =>
                      entry.items.some((item) =>
                        item.name.toLowerCase().includes(selectedRouteSearch.trim().toLowerCase()),
                      ) || selectedRouteSearch.trim() === "",
                    )
                    .map((entry) => (
                    <article key={entry.id} className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-amber-200">
                          {new Date(entry.date).toLocaleString("es-MX", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Unidad</p>
                          <span className="text-sm font-bold text-slate-200">{entry.unit || "Sin unidad"}</span>
                        </div>
                      </div>

                      <ul className="mt-3 space-y-2 text-sm text-slate-200">
                        {entry.items.map((item) => (
                          <li key={`${entry.id}-${item.id}`} className="flex items-center justify-between gap-3 border-b border-slate-700 pb-2 last:border-b-0 last:pb-0">
                            <span>
                              {item.name} x{item.quantity}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
