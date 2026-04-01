const http = require("http");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || ROOT;
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, "jewel-loan-management.sqlite");
const STATE_KEY = "main";

const CATEGORY_NAMES = ["Agri", "Retail", "KCC", "MSME"];
const APPRAISERS = ["Selvaraj", "NallaThambi", "Raja"];
const LEGACY_APPRAISER_MAP = {
  Appraiser1: "Selvaraj",
  Appraiser2: "NallaThambi",
  Appraiser3: "Raja",
  Nallathambi: "NallaThambi",
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const database = new DatabaseSync(DB_FILE);
database.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

const getStateStatement = database.prepare("SELECT payload FROM app_state WHERE id = ?");
const putStateStatement = database.prepare(`
  INSERT INTO app_state (id, payload, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    payload = excluded.payload,
    updated_at = excluded.updated_at
`);

ensureStateRow();

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (requestUrl.pathname === "/health") {
    sendJson(response, 200, {
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (requestUrl.pathname === "/api/state") {
    await handleStateApi(request, response);
    return;
  }

  serveStaticFile(requestUrl.pathname, response);
});

server.listen(PORT, () => {
  console.log(`Jewel Loan app running at http://localhost:${PORT}`);
  console.log(`SQLite database file: ${DB_FILE}`);
});

async function handleStateApi(request, response) {
  try {
    if (request.method === "GET") {
      sendJson(response, 200, loadState());
      return;
    }

    if (request.method === "PUT") {
      const payload = await readJsonBody(request);

      if (!payload || typeof payload !== "object") {
        sendJson(response, 400, { error: "Invalid state payload." });
        return;
      }

      const nextState = sanitizeState(payload);
      saveState(nextState);
      sendJson(response, 200, nextState);
      return;
    }

    sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Server error while accessing the database." });
  }
}

function serveStaticFile(requestPath, response) {
  const safeRequestPath = requestPath === "/" ? "/index.html" : requestPath;
  const normalized = path.normalize(safeRequestPath).replace(/^(\.\.[\\/])+/, "");
  const filePath = path.join(ROOT, normalized);

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end(error.code === "ENOENT" ? "Not Found" : "Server Error");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
    });
    response.end(data);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function ensureStateRow() {
  const row = getStateStatement.get(STATE_KEY);

  if (!row) {
    saveState(createDefaultState());
  }
}

function loadState() {
  const row = getStateStatement.get(STATE_KEY);
  return row ? sanitizeState(JSON.parse(row.payload)) : createDefaultState();
}

function saveState(state) {
  putStateStatement.run(STATE_KEY, JSON.stringify(sanitizeState(state)), new Date().toISOString());
}

function sanitizeState(rawState) {
  const defaultState = createDefaultState();
  const source = rawState && typeof rawState === "object" ? rawState : {};
  const legacyCounts = source.appraiserStats?.counts || {};
  const migratedLoans = Array.isArray(source.loans)
    ? source.loans.map((loan) => ({
      ...loan,
      appraiser: LEGACY_APPRAISER_MAP[loan.appraiser] || loan.appraiser,
    }))
    : [];

  return {
    ...defaultState,
    ...source,
    id: STATE_KEY,
    auth: { ...defaultState.auth, ...(source.auth || {}) },
    categories: CATEGORY_NAMES.reduce((all, name) => {
      all[name] = { ...defaultState.categories[name], ...(source.categories?.[name] || {}) };
      return all;
    }, {}),
    loans: migratedLoans,
    adjustments: Array.isArray(source.adjustments) ? source.adjustments : [],
    manualEntries: Array.isArray(source.manualEntries) ? source.manualEntries : [],
    appraiserStats: {
      ...defaultState.appraiserStats,
      ...(source.appraiserStats || {}),
      counts: APPRAISERS.reduce((counts, name) => {
        counts[name] = Number(legacyCounts[name] ?? 0);

        for (const [legacyName, mappedName] of Object.entries(LEGACY_APPRAISER_MAP)) {
          if (mappedName === name) {
            counts[name] += Number(legacyCounts[legacyName] ?? 0);
          }
        }

        return counts;
      }, {}),
    },
  };
}

function createDefaultState() {
  return {
    id: STATE_KEY,
    auth: { username: "admin", password: "admin123" },
    categoriesInitialized: false,
    categorySetupDate: null,
    categories: CATEGORY_NAMES.reduce((all, name) => {
      all[name] = { pockets: 0, weight: 0, amount: 0 };
      return all;
    }, {}),
    loans: [],
    adjustments: [],
    manualEntries: [],
    appraiserStats: {
      period: getCurrentPeriod(),
      counts: APPRAISERS.reduce((counts, name) => {
        counts[name] = 0;
        return counts;
      }, {}),
    },
  };
}

function getCurrentPeriod() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}
