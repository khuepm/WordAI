import express from 'express';
import { errorHandler, notFoundHandler, requestLogger } from './middleware';

const app = express();
const PORT = process.env.PORT ?? 3001;

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

app.use(express.json());
app.use(requestLogger);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ---------------------------------------------------------------------------
// Error handling — must be registered after all routes
// ---------------------------------------------------------------------------

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Bridge API listening on port ${PORT}`);
});

export default app;
