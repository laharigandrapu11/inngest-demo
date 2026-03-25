import express from "express";
import { serve } from "inngest/express";
import { inngest, processRfq } from "./rfq";

const app = express();
app.use(express.json());

// ── Inngest webhook handler ────────────────────────────────────────────────────
// The Inngest dev server calls this endpoint to discover and invoke functions.
app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions: [processRfq],
  })
);

// ── POST /rfq — trigger the RFQ workflow ──────────────────────────────────────
app.post("/rfq", async (req, res) => {
  const { partNumber, quantity, material } = req.body;

  if (!partNumber || !quantity || !material) {
    return res.status(400).json({
      error: "Missing required fields: partNumber, quantity, material",
    });
  }

  const result = await inngest.send({
    name: "rfq/submitted",
    data: { partNumber, quantity, material },
  });

  return res.status(202).json({
    message: "RFQ received — processing started",
    eventId: result.ids[0],
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Express server running at http://localhost:${PORT}`);
  console.log(`   Inngest handler: http://localhost:${PORT}/api/inngest`);
  console.log(`   Inngest dev UI:  http://localhost:8288\n`);
});
