/**
 * AuraSphere Agent Framework — Bridge API Routes
 *
 * Implements the HTTP endpoints for the Agent Engine:
 * - POST /execute — submit a task and wait for the result
 * - POST /stream — submit a task with SSE streaming response
 * - GET /status/:taskId — poll execution status
 * - GET /templates — list available workflow templates
 * - GET /health — provider health and uptime
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10,
 *               6.11, 6.12, 6.13, 6.14, 6.15
 */

import { Router, Request, Response, NextFunction } from 'express';
import type {
  AgentExecuteRequest,
  AgentExecuteResponse,
  AgentStatusResponse,
  AgentHealthResponse,
  AgentTemplatesResponse,
  AgentTask,
  SSEEvent,
  WorkflowTemplate,
} from '../agent/types';

// ---------------------------------------------------------------------------
// AgentEngine Interface (minimal — full implementation in task 12.2)
// ---------------------------------------------------------------------------

/**
 * Minimal interface for the Agent Engine consumed by the route layer.
 * The full implementation will be provided by the AgentEngine class.
 */
export interface AgentEngine {
  /** Execute a task synchronously and return the result. */
  execute(task: AgentTask): Promise<AgentExecuteResponse>;

  /** Execute a task with streaming, emitting SSE events via the callback. */
  executeStream(
    task: AgentTask,
    onEvent: (event: SSEEvent) => void,
  ): Promise<void>;

  /** Get the current status of a task by ID. */
  getTaskStatus(taskId: string): AgentStatusResponse | null;

  /** Get all available workflow templates. */
  getTemplates(): WorkflowTemplate[];

  /** Get health information about the engine. */
  getHealth(): AgentHealthResponse;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum request body size in bytes (100KB). Requirement 6.15. */
const MAX_BODY_SIZE_BYTES = 100 * 1024;

/** Minimum intent length. Requirement 6.5. */
const MIN_INTENT_LENGTH = 1;

/** Maximum intent length. Requirement 6.5. */
const MAX_INTENT_LENGTH = 2000;

/** Maximum content length. Requirement 6.5. */
const MAX_CONTENT_LENGTH = 50000;

/** Valid tier preference values. */
const VALID_TIERS = ['turbo', 'pro'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateTraceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate the request body for POST /execute and POST /stream.
 * Requirement 6.5: intent (1-2000 chars), content (max 50000), tier_preference, template_id.
 */
function validateExecuteRequest(
  body: unknown,
  availableTemplateIds: string[],
): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'] };
  }

  const { intent, content, tier_preference, template_id } = body as Record<string, unknown>;

  // intent: required, 1-2000 characters
  if (intent === undefined || intent === null) {
    errors.push('intent is required');
  } else if (typeof intent !== 'string') {
    errors.push('intent must be a string');
  } else if (intent.length < MIN_INTENT_LENGTH || intent.length > MAX_INTENT_LENGTH) {
    errors.push(`intent must be between ${MIN_INTENT_LENGTH} and ${MAX_INTENT_LENGTH} characters`);
  }

  // content: optional, max 50000 characters
  if (content !== undefined && content !== null) {
    if (typeof content !== 'string') {
      errors.push('content must be a string');
    } else if (content.length > MAX_CONTENT_LENGTH) {
      errors.push(`content must not exceed ${MAX_CONTENT_LENGTH} characters`);
    }
  }

  // tier_preference: optional, must be "turbo" or "pro"
  if (tier_preference !== undefined && tier_preference !== null) {
    if (!VALID_TIERS.includes(tier_preference as typeof VALID_TIERS[number])) {
      errors.push('tier_preference must be "turbo" or "pro"');
    }
  }

  // template_id: optional, must match a registered template
  if (template_id !== undefined && template_id !== null) {
    if (typeof template_id !== 'string') {
      errors.push('template_id must be a string');
    } else if (!availableTemplateIds.includes(template_id)) {
      errors.push(`template_id "${template_id}" does not match a registered workflow template`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Middleware: Authentication
// ---------------------------------------------------------------------------

/**
 * Authentication middleware for agent routes.
 * Checks for a valid session via X-Session-Id header.
 * Requirement 6.7, 6.8: Authenticate user via session, return 401 if missing.
 */
function createAuthMiddleware(
  getUserIdFromSession: (sessionId: string) => string | null,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const sessionId = req.headers['x-session-id'];

    if (!sessionId || typeof sessionId !== 'string') {
      res.status(401).json({
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required. Provide a valid X-Session-Id header.',
          trace_id: generateTraceId(),
        },
      });
      return;
    }

    const userId = getUserIdFromSession(sessionId);
    if (!userId) {
      res.status(401).json({
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Invalid or expired session.',
          trace_id: generateTraceId(),
        },
      });
      return;
    }

    // Attach userId to request for downstream handlers
    (req as any).userId = userId;
    next();
  };
}

// ---------------------------------------------------------------------------
// Middleware: Quota Check
// ---------------------------------------------------------------------------

/**
 * Quota middleware for agent routes.
 * Checks that the user has remaining AI quota before allowing execution.
 * Requirement 6.9, 6.10: Check quota, return 403 if exceeded.
 * Requirement 6.14: Each task execution counts as one quota unit.
 */
function createQuotaMiddleware(
  checkQuota: (userId: string) => { allowed: boolean; remaining: number },
  consumeQuota: (userId: string) => void,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = (req as any).userId as string;

    const { allowed } = checkQuota(userId);
    if (!allowed) {
      res.status(403).json({
        error: {
          code: 'AI_QUOTA_EXCEEDED',
          message: 'Monthly AI quota has been exhausted.',
          trace_id: generateTraceId(),
        },
      });
      return;
    }

    // Consume one quota unit for this task execution (Requirement 6.14)
    consumeQuota(userId);
    next();
  };
}

// ---------------------------------------------------------------------------
// Middleware: Body Size Limit
// ---------------------------------------------------------------------------

/**
 * Validates that the raw request body does not exceed 100KB.
 * Requirement 6.15: Enforce 100KB request body size limit.
 */
function bodySizeLimit(req: Request, res: Response, next: NextFunction): void {
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE_BYTES) {
    res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: `Request body must not exceed ${MAX_BODY_SIZE_BYTES} bytes (100KB).`,
        trace_id: generateTraceId(),
      },
    });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Router Options
// ---------------------------------------------------------------------------

export interface AgentRouterOptions {
  /**
   * Resolves a session ID to a user ID. Returns null if the session is invalid.
   */
  getUserIdFromSession: (sessionId: string) => string | null;

  /**
   * Checks whether the user has remaining AI quota.
   */
  checkQuota: (userId: string) => { allowed: boolean; remaining: number };

  /**
   * Consumes one quota unit for the user.
   */
  consumeQuota: (userId: string) => void;
}

// ---------------------------------------------------------------------------
// Router Factory
// ---------------------------------------------------------------------------

/**
 * Creates an Express router for the AuraSphere Agent API endpoints.
 *
 * The router is mounted at /ai/agent in the main Express app.
 *
 * @param engine - The AgentEngine instance that handles task execution
 * @param options - Authentication and quota callback functions
 * @returns Express Router with all agent endpoints
 */
export function createAgentRouter(
  engine: AgentEngine,
  options: AgentRouterOptions,
): Router {
  const router = Router();

  const authMiddleware = createAuthMiddleware(options.getUserIdFromSession);
  const quotaMiddleware = createQuotaMiddleware(options.checkQuota, options.consumeQuota);

  // ---------------------------------------------------------------------------
  // GET /health — provider status, config validity, uptime
  // Requirement 6.5 (health endpoint does NOT require auth)
  // ---------------------------------------------------------------------------
  router.get('/health', (_req: Request, res: Response) => {
    const health = engine.getHealth();
    res.json(health);
  });

  // ---------------------------------------------------------------------------
  // GET /templates — list available workflow templates
  // Requirement 6.4: List available Workflow_Templates
  // ---------------------------------------------------------------------------
  router.get('/templates', authMiddleware, (_req: Request, res: Response) => {
    const templates = engine.getTemplates();
    const response: AgentTemplatesResponse = {
      templates: templates.map((t) => ({
        template_id: t.template_id,
        name: t.name,
        description: t.description,
        agents_involved: t.steps.map((s) => s.agent_role),
      })),
    };
    res.json(response);
  });

  // ---------------------------------------------------------------------------
  // GET /status/:taskId — return task status, progress, result
  // Requirement 6.2, 6.12
  // ---------------------------------------------------------------------------
  router.get('/status/:taskId', authMiddleware, (req: Request, res: Response) => {
    const { taskId } = req.params;

    const status = engine.getTaskStatus(taskId);
    if (!status) {
      res.status(404).json({
        error: {
          code: 'TASK_NOT_FOUND',
          message: `Task "${taskId}" not found.`,
          trace_id: generateTraceId(),
        },
      });
      return;
    }

    res.json(status);
  });

  // ---------------------------------------------------------------------------
  // POST /execute — validate body, authenticate, check quota, execute task
  // Requirements: 6.1, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.14, 6.15
  // ---------------------------------------------------------------------------
  router.post(
    '/execute',
    bodySizeLimit,
    authMiddleware,
    quotaMiddleware,
    async (req: Request, res: Response) => {
      // Validate request body (Requirement 6.5, 6.6)
      const templateIds = engine.getTemplates().map((t) => t.template_id);
      const validation = validateExecuteRequest(req.body, templateIds);

      if (!validation.valid) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: `Request validation failed: ${validation.errors.join('; ')}`,
            trace_id: generateTraceId(),
          },
        });
        return;
      }

      const body = req.body as AgentExecuteRequest;
      const userId = (req as any).userId as string;

      // Build AgentTask
      const task: AgentTask = {
        task_id: generateTraceId(),
        intent: body.intent,
        content: body.content,
        tier_preference: body.tier_preference,
        template_id: body.template_id,
        user_id: userId,
        trace_id: generateTraceId(),
        created_at: new Date().toISOString(),
      };

      try {
        // Execute task via engine (Requirement 6.11)
        const result = await engine.execute(task);
        res.json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unexpected error occurred';
        res.status(500).json({
          error: {
            code: 'AGENT_EXECUTION_ERROR',
            message,
            trace_id: task.trace_id,
          },
        });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // POST /stream — validate body, authenticate, check quota, stream via SSE
  // Requirements: 6.3, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.13, 6.14, 6.15
  // ---------------------------------------------------------------------------
  router.post(
    '/stream',
    bodySizeLimit,
    authMiddleware,
    quotaMiddleware,
    async (req: Request, res: Response) => {
      // Validate request body (Requirement 6.5, 6.6)
      const templateIds = engine.getTemplates().map((t) => t.template_id);
      const validation = validateExecuteRequest(req.body, templateIds);

      if (!validation.valid) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: `Request validation failed: ${validation.errors.join('; ')}`,
            trace_id: generateTraceId(),
          },
        });
        return;
      }

      const body = req.body as AgentExecuteRequest;
      const userId = (req as any).userId as string;

      // Build AgentTask
      const task: AgentTask = {
        task_id: generateTraceId(),
        intent: body.intent,
        content: body.content,
        tier_preference: body.tier_preference,
        template_id: body.template_id,
        user_id: userId,
        trace_id: generateTraceId(),
        created_at: new Date().toISOString(),
      };

      // Set SSE headers (Requirement 6.13)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      try {
        // Stream events in order: task_accepted → agent_started → token_chunk → agent_completed → task_completed
        await engine.executeStream(task, (event: SSEEvent) => {
          res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
        });
      } catch (error) {
        // Emit an error event over SSE
        const message = error instanceof Error ? error.message : 'An unexpected error occurred';
        res.write(
          `event: error\ndata: ${JSON.stringify({ code: 'AGENT_EXECUTION_ERROR', message, trace_id: task.trace_id })}\n\n`,
        );
      } finally {
        res.end();
      }
    },
  );

  return router;
}
