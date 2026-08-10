import express from "express";
import { success } from "./bootstrap/api-response";
import { requestTraceMiddleware } from "./middleware/request-trace.middleware";

const app = express();

const port = process.env.PORT
  ? Number(process.env.PORT)
  : 3000;

app.use(express.json());
app.use(requestTraceMiddleware);

app.get("/health", (_req, res) => {
  res.status(200).json(
    success({
      status: "ok",
      requestId: res.locals.requestId,
      correlationId: res.locals.correlationId
    })
  );
});

app.listen(port, () => {
  console.log(`Cadence API running on http://localhost:${port}`);
});