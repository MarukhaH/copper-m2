// Module 2: the four tools Ask Copper can use. Products and prices come from
// lib/copper/catalog.ts and stock from lib/copper/inventory.ts, so the
// chatbot never has to make them up.
// The contract for each tool is in specs/module-2/spec.md.
import { tool } from "ai";
import { z } from "zod";
import {
  getPlans,
  getProducts,
  type Plan,
  type ProductId,
} from "@/lib/copper/catalog";
import { readInventory } from "@/lib/copper/inventory";

export type ProductList = {
  products: {
    id: ProductId;
    name: string;
    type: string;
    priceUsd: number;
    colors: string[];
  }[];
};

export type Prices = {
  products: { id: ProductId; name: string; priceUsd: number }[];
  plans: {
    id: Plan["id"];
    name: string;
    monthlyUsd: number;
    annualUsd: number;
  }[];
};

export type CalculateCostInput = {
  products: ProductId[];
  plan: Plan["id"];
  billing: "monthly" | "annual";
  years: number;
};

export type CostBreakdown = {
  lines: { item: string; usd: number }[];
  totalUsd: number;
};

export type CheckAvailabilityInput = { product: ProductId; color?: string };

export type Stock = "in_stock" | "low_stock" | "backordered";

export type Availability =
  | {
      status: "ok";
      product: string;
      colors: { color: string; stock: Stock; restockDate: string | null }[];
    }
  | { status: "not_a_color"; product: string; color: string; colors: string[] }
  | { status: "unavailable"; message: string };

const PRODUCT_IDS = ["copper-home", "copper-notes"] as const;

/** Rounds to whole cents, so sums of prices don't pick up float noise. */
const cents = (usd: number) => Math.round(usd * 100) / 100;

/** get_products: what Copper sells and which colors each one comes in. */
export function listProducts(): ProductList {
  return {
    products: getProducts().map(({ id, name, type, priceUsd, colors }) => ({
      id,
      name,
      type,
      priceUsd,
      colors,
    })),
  };
}

/** get_prices: every product and plan price, read from the catalog. */
export function getPrices(): Prices {
  return {
    products: getProducts().map(({ id, name, priceUsd }) => ({
      id,
      name,
      priceUsd,
    })),
    plans: getPlans().map(({ id, name, monthlyUsd, annualUsd }) => ({
      id,
      name,
      monthlyUsd,
      annualUsd,
    })),
  };
}

export const calculateCostInput: z.ZodType<CalculateCostInput> = z.object({
  products: z.array(z.enum(PRODUCT_IDS)).max(5),
  plan: z.enum(["free", "copper-plus"]),
  billing: z.enum(["monthly", "annual"]),
  years: z.number().int().min(1).max(5),
});

/** calculate_cost: the total cost of devices plus a plan over some years. */
export function calculateCost(input: CalculateCostInput): CostBreakdown {
  const catalog = getProducts();
  const lines: CostBreakdown["lines"] = input.products.map((id) => {
    const product = catalog.find((p) => p.id === id)!;
    return { item: product.name, usd: cents(product.priceUsd) };
  });

  // The free plan costs nothing, so it gets no line. Copper Plus covers the
  // whole household, so it's counted once however many devices there are.
  const plan = getPlans().find((p) => p.id === input.plan)!;
  if (plan.monthlyUsd > 0 || plan.annualUsd > 0) {
    const usd =
      input.billing === "monthly"
        ? plan.monthlyUsd * 12 * input.years
        : plan.annualUsd * input.years;
    const term = input.years === 1 ? "1 year" : `${input.years} years`;
    lines.push({
      item: `${plan.name}, ${input.billing}, ${term}`,
      usd: cents(usd),
    });
  }

  return {
    lines,
    totalUsd: cents(lines.reduce((sum, line) => sum + line.usd, 0)),
  };
}

export const checkAvailabilityInput: z.ZodType<CheckAvailabilityInput> =
  z.object({
    product: z.enum(PRODUCT_IDS),
    color: z.string().optional(),
  });

function stockLevel(units: number): Stock {
  if (units <= 0) return "backordered";
  return units < 10 ? "low_stock" : "in_stock";
}

/** check_availability: stock for one product (or one of its colors), read fresh each time. */
export async function checkAvailability(
  input: CheckAvailabilityInput,
): Promise<Availability> {
  const product = getProducts().find((p) => p.id === input.product)!;

  // A color the product doesn't come in is a catalog fact, so it's answered
  // before stock is read (and even when stock can't be read).
  const wanted = input.color?.trim().toLowerCase();
  if (wanted !== undefined && wanted !== "") {
    const known = product.colors.some((c) => c.toLowerCase() === wanted);
    if (!known) {
      return {
        status: "not_a_color",
        product: product.name,
        color: input.color!,
        colors: product.colors,
      };
    }
  }

  const rows = await readInventory();
  if (rows === null) {
    return {
      status: "unavailable",
      message: "Stock can't be checked right now. Please try again soon.",
    };
  }

  // Stock rows hold the display name ("Copper Notes"), not the id. Colors keep
  // the catalog's capitalization.
  const colors = product.colors.flatMap((color) => {
    if (wanted && color.toLowerCase() !== wanted) return [];
    const row = rows.find(
      (r) =>
        r.product === product.name &&
        r.color.toLowerCase() === color.toLowerCase(),
    );
    if (!row) return [];
    const stock = stockLevel(row.units_in_stock);
    return [
      {
        color,
        stock,
        restockDate: stock === "backordered" ? row.next_shipment : null,
      },
    ];
  });

  return { status: "ok", product: product.name, colors };
}

export const copperTools = {
  get_products: tool({
    description:
      "Lists every Copper product with its type, price and the colors it comes in. Says nothing about stock.",
    inputSchema: z.object({}),
    execute: async () => listProducts(),
  }),
  get_prices: tool({
    description:
      "Gets the current price of every Copper product and every plan (monthly and annual).",
    inputSchema: z.object({}),
    execute: async () => getPrices(),
  }),
  calculate_cost: tool({
    description:
      "Works out the total cost of devices plus a plan (free or Copper Plus) over 1 to 5 years, billed monthly or annually.",
    inputSchema: calculateCostInput,
    execute: async (input) => calculateCost(input),
  }),
  check_availability: tool({
    description:
      "Checks today's stock for a Copper product, for every color or one color, including restock dates.",
    inputSchema: checkAvailabilityInput,
    execute: async (input) => checkAvailability(input),
  }),
};
