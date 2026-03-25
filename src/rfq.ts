import { Inngest } from "inngest";
import { v4 as uuidv4 } from "uuid";

// Create the Inngest client — connects to the dev server at localhost:8288
export const inngest = new Inngest({ id: "rfq-demo" });

// ─── Types ────────────────────────────────────────────────────────────────────

type Material = "steel" | "aluminum" | "plastic";

interface RfqEventData {
  partNumber: string;
  quantity: number;
  material: Material;
}

// ─── Pricing table ────────────────────────────────────────────────────────────

const BASE_PRICE: Record<Material, number> = {
  steel: 12,
  aluminum: 18,
  plastic: 5,
};

// ─── Inngest function: processRfq ─────────────────────────────────────────────

export const processRfq = inngest.createFunction(
  { id: "process-rfq", name: "Process RFQ", retries: 0 },
  { event: "rfq/submitted" },
  async ({ event, step }) => {
    const data = event.data as RfqEventData;

    // ── Step 1: Parse the RFQ ─────────────────────────────────────────────────
    const parsed = await step.run("parse-rfq", async () => {
      await sleep(1000); // Simulate parsing/validation service

      if (!data.partNumber || data.partNumber.trim() === "") {
        throw new Error("partNumber is required");
      }
      if (!data.quantity || data.quantity <= 0) {
        throw new Error("quantity must be greater than 0");
      }
      const validMaterials: Material[] = ["steel", "aluminum", "plastic"];
      if (!validMaterials.includes(data.material)) {
        throw new Error(`material must be one of: ${validMaterials.join(", ")}`);
      }

      return {
        partNumber: data.partNumber.trim(),
        quantity: data.quantity,
        material: data.material,
        parsedAt: new Date().toISOString(),
      };
    });

    // ── Step 2: Check Inventory ───────────────────────────────────────────────
    const inventory = await step.run("check-inventory", async () => {
      await sleep(2000); // Simulate ERP/DB query

      const inStock = parsed.quantity <= 50;
      return {
        inStock,
        availableQty: inStock ? 100 : 0,
        warehouseLocation: inStock ? "Warehouse A, Bay 12" : "N/A — backordered",
      };
    });

    // ── Step 3: Generate Quote ────────────────────────────────────────────────
    const quote = await step.run("generate-quote", async () => {
      await sleep(1000); // Simulate pricing engine

      const unitPrice = BASE_PRICE[parsed.material] * (inventory.inStock ? 1.0 : 1.15);
      const totalPrice = unitPrice * parsed.quantity;
      const leadTimeDays = inventory.inStock ? 5 : 21;
      const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      return {
        quoteId: uuidv4(),
        unitPrice: Math.round(unitPrice * 100) / 100,
        totalPrice: Math.round(totalPrice * 100) / 100,
        leadTimeDays,
        validUntil,
      };
    });

    console.log("\n✅ RFQ Processed:", JSON.stringify({ parsed, inventory, quote }, null, 2));
    return { parsed, inventory, quote };
  }
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
