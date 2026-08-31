import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import express from "express";

import type { RequestContext } from "../../bootstrap/request-context";
import type { AuthenticatedRequestState } from "../../middleware/authenticate";

import {
  DiscussionPermissionDeniedError,
  DiscussionProjectNotFoundError,
} from "./discussion.errors";
import {
  createDiscussionRouter,
} from "./discussion.routes";
import type { DiscussionService } from "./discussion.service";
import type { DiscussionMessage } from "./discussion.types";


const projectId =
  "11111111-1111-4111-8111-111111111111";

const actorUserId =
  "22222222-2222-4222-8222-222222222222";

const actorPersonId =
  "33333333-3333-4333-8333-333333333333";

const requestId =
  "44444444-4444-4444-8444-444444444444";

const correlationId =
  "55555555-5555-4555-8555-555555555555";


const context: RequestContext = {
  actorUserId,
  actorPersonId,
  correlationId,
  requestId,
  source: "api",
  identityProvider: "test",
};


type JsonObject = Record<string, unknown>;


type DiscussionServiceStub = {
  listProjectMessages(
    receivedContext: RequestContext,
    receivedProjectId: string
  ): Promise<DiscussionMessage[]>;

  postMessage(
    receivedContext: RequestContext,
    receivedProjectId: string,
    content: string,
    threadParentId: string | null
  ): Promise<DiscussionMessage>;
};


function createMessage(
  overrides: Partial<DiscussionMessage> = {}
): DiscussionMessage {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    projectId,
    authorUserId: actorUserId,
    authorType: "human",
    threadParentId: null,
    currentVersion: 1,
    content: "Persisted project context",
    createdAt: "2026-08-14T00:00:00.000Z",
    editedAt: null,
    ...overrides,
  };
}


function createService(options: {
  messages?: DiscussionMessage[];
  listError?: unknown;
} = {}): {
  service: DiscussionService;
  listCalls: Array<{
    context: RequestContext;
    projectId: string;
  }>;
  postCalls: Array<{
    context: RequestContext;
    projectId: string;
    content: string;
    threadParentId: string | null;
  }>;
} {
  const listCalls: Array<{
    context: RequestContext;
    projectId: string;
  }> = [];

  const postCalls: Array<{
    context: RequestContext;
    projectId: string;
    content: string;
    threadParentId: string | null;
  }> = [];

  const service: DiscussionServiceStub = {
    async listProjectMessages(
      receivedContext,
      receivedProjectId
    ): Promise<DiscussionMessage[]> {
      listCalls.push({
        context: receivedContext,
        projectId: receivedProjectId,
      });

      if (options.listError !== undefined) {
        throw options.listError;
      }

      return options.messages ?? [];
    },

    async postMessage(
      receivedContext,
      receivedProjectId,
      content,
      threadParentId
    ): Promise<DiscussionMessage> {
      postCalls.push({
        context: receivedContext,
        projectId: receivedProjectId,
        content,
        threadParentId,
      });

      return createMessage({
        projectId: receivedProjectId,
        content,
        threadParentId,
      });
    },
  };

  return {
    service: service as unknown as DiscussionService,
    listCalls,
    postCalls,
  };
}


async function request(
  service: DiscussionService,
  path: string,
  init?: RequestInit
): Promise<{
  status: number;
  body: JsonObject;
}> {
  const app = express();

  app.use(express.json());

  app.use((_req, res, next) => {
    res.locals.authenticated = {
      user: {
        id: actorUserId,
        personId: actorPersonId,
        displayName: "Project Member",
        email: "member@example.test",
        status: "active",
        identityProvider: "test",
      },
      context,
    } satisfies AuthenticatedRequestState;

    next();
  });

  app.use(
    "/api/v1",
    createDiscussionRouter(service)
  );

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found.",
        correlation_id: correlationId,
        details: {},
      },
    });
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({
      forwarded: true,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  const server = app.listen(0, "127.0.0.1");

  await once(server, "listening");

  const address = server.address() as AddressInfo;

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}${path}`,
      init
    );

    return {
      status: response.status,
      body: await response.json() as JsonObject,
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}


test(
  "GET messages returns 200 with the standard mapped message envelope",
  async () => {
    const messages = [
      createMessage({
        id: "77777777-7777-4777-8777-777777777777",
        authorUserId: actorUserId,
        threadParentId: null,
        currentVersion: 2,
        content: "First persisted message",
        createdAt: "2026-08-14T00:00:00.000Z",
        editedAt: "2026-08-15T00:00:00.000Z",
      }),
    ];
    const { service, listCalls } = createService({ messages });

    const response = await request(
      service,
      `/api/v1/projects/${projectId}/messages`
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.deepEqual(response.body.data, {
      messages: [{
        id: messages[0].id,
        project_id: projectId,
        author_user_id: actorUserId,
        author_type: "human",
        thread_parent_id: null,
        current_version: 2,
        content: "First persisted message",
        created_at: "2026-08-14T00:00:00.000Z",
        edited_at: "2026-08-15T00:00:00.000Z",
      }],
    });
    assert.deepEqual(listCalls, [{ context, projectId }]);
  }
);


test(
  "GET messages preserves the service message order",
  async () => {
    const messages = [
      createMessage({
        id: "88888888-8888-4888-8888-888888888888",
        content: "Second",
        createdAt: "2026-08-14T00:00:02.000Z",
      }),
      createMessage({
        id: "99999999-9999-4999-8999-999999999999",
        content: "First",
        createdAt: "2026-08-14T00:00:01.000Z",
      }),
    ];
    const { service } = createService({ messages });

    const response = await request(
      service,
      `/api/v1/projects/${projectId}/messages`
    );

    const data = response.body.data as JsonObject;
    const returnedMessages = data.messages as JsonObject[];

    assert.deepEqual(
      returnedMessages.map((message) => message.id),
      messages.map((message) => message.id)
    );
  }
);


test(
  "GET messages includes correlation, request, and null cursor metadata",
  async () => {
    const { service } = createService();

    const response = await request(
      service,
      `/api/v1/projects/${projectId}/messages`
    );

    assert.deepEqual(response.body.meta, {
      correlation_id: correlationId,
      request_id: requestId,
      next_cursor: null,
    });
  }
);


test(
  "GET messages returns an empty message collection when the service is empty",
  async () => {
    const { service } = createService({ messages: [] });

    const response = await request(
      service,
      `/api/v1/projects/${projectId}/messages`
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, { messages: [] });
  }
);


test(
  "GET messages rejects an invalid project UUID without calling the service",
  async () => {
    const { service, listCalls } = createService();

    const response = await request(
      service,
      "/api/v1/projects/not-a-uuid/messages"
    );

    assert.equal(response.status, 400);
    const error = response.body.error as JsonObject;
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.deepEqual(listCalls, []);
  }
);


test(
  "GET messages maps a concealed project to 404 NOT_FOUND",
  async () => {
    const { service } = createService({
      listError: new DiscussionProjectNotFoundError(),
    });

    const response = await request(
      service,
      `/api/v1/projects/${projectId}/messages`
    );

    assert.equal(response.status, 404);
    const error = response.body.error as JsonObject;
    assert.equal(error.code, "NOT_FOUND");
    assert.equal(error.message, "Project not found.");
    assert.doesNotMatch(String(error.message), /permission|membership|authorization/i);
  }
);


test(
  "GET messages maps a denied project to 403 PERMISSION_DENIED",
  async () => {
    const { service } = createService({
      listError: new DiscussionPermissionDeniedError(),
    });

    const response = await request(
      service,
      `/api/v1/projects/${projectId}/messages`
    );

    assert.equal(response.status, 403);
    const error = response.body.error as JsonObject;
    assert.equal(error.code, "PERMISSION_DENIED");
  }
);


test(
  "GET messages passes unexpected service errors to Express error handling",
  async () => {
    const unexpected = new Error("discussion read unavailable");
    const { service } = createService({ listError: unexpected });

    const response = await request(
      service,
      `/api/v1/projects/${projectId}/messages`
    );

    assert.equal(response.status, 500);
    assert.deepEqual(response.body, {
      forwarded: true,
      error: unexpected.message,
    });
  }
);


test(
  "GET messages does not invoke postMessage",
  async () => {
    const { service, postCalls } = createService();

    await request(
      service,
      `/api/v1/projects/${projectId}/messages`
    );

    assert.deepEqual(postCalls, []);
  }
);


test(
  "POST messages retains its 201 success contract and request context",
  async () => {
    const { service, postCalls } = createService();
    const threadParentId =
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const response = await request(
      service,
      `/api/v1/projects/${projectId}/messages`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          content: "A durable message",
          thread_parent_id: threadParentId,
        }),
      }
    );

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);
    assert.deepEqual(postCalls, [{
      context,
      projectId,
      content: "A durable message",
      threadParentId,
    }]);
    assert.deepEqual(response.body.meta, {
      correlation_id: correlationId,
      request_id: requestId,
      next_cursor: null,
    });
  }
);


test(
  "POST messages retains UUID validation and does not call the service on invalid input",
  async () => {
    const { service, postCalls } = createService();

    const response = await request(
      service,
      "/api/v1/projects/not-a-uuid/messages",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ content: "A message" }),
      }
    );

    assert.equal(response.status, 400);
    const error = response.body.error as JsonObject;
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.deepEqual(postCalls, []);
  }
);
