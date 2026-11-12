export type InventoryCategory =
  | "Mecánica"
  | "Neumáticos"
  | "Filtros"
  | "Frenos"
  | "Eléctrico"
  | "Servicio";

export type InventoryItem = {
  id: string;
  name: string;
  category: InventoryCategory;
  price: number;
  stock: number;
};

export type ServiceItem = {
  id: string;
  name: string;
  price: number;
};

export type CartItem = {
  id: string;
  name: string;
  category: InventoryCategory;
  price: number;
  quantity: number;
};

export type RouteRecord = {
  id: string;
  name: string;
  unit: string;
};

export type HistoryEntry = {
  id: string;
  route: string;
  date: string;
  unit: string;
  items: CartItem[];
  total: number;
};

export type Notification = {
  type: "success" | "error";
  message: string;
};
