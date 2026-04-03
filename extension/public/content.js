/**
 * Catan Resource Tracker - Content Script
 *
 * Observes the colonist.io game log (chat panel) and parses resource gain events.
 *
 * HOW TO VERIFY SELECTORS:
 *   Open colonist.io, start a game, open DevTools > Inspector, and look for:
 *   - The scrollable chat/log container (currently: #game-log-container or .message-feed)
 *   - Individual log message rows (look for divs added on each game event)
 *   Update CHAT_CONTAINER_SELECTOR and MESSAGE_SELECTOR below if needed.
 *
 * MESSAGE FORMAT (colonist.io as of 2024):
 *   Resource gain:  "<PlayerName> received: [resource images]"
 *   Dice roll:      "<PlayerName> rolled: X + Y = Z"
 *   Robber steal:   "<PlayerName> stole from <PlayerName2>"
 *   Trade:          "<PlayerName> and <PlayerName2> traded"
 *
 * Resource images have alt text like "wood", "brick", "wheat", "ore", "sheep"
 * or class names referencing the resource type.
 */

// ── Selectors ────────────────────────────────────────────────────────────────
// These target the game log panel. Verify in DevTools if messages aren't parsed.
const CHAT_CONTAINER_SELECTOR = "#game-log-container";
const MESSAGE_ROW_SELECTOR = ".message-feed-item, .log-message, [class*='message']";

// ── Resource aliases ──────────────────────────────────────────────────────────
// Maps various text/alt/class representations to canonical resource names.
const RESOURCE_ALIASES = {
  wood: "wood", lumber: "wood", forest: "wood",
  brick: "brick", clay: "brick",
  wheat: "wheat", grain: "wheat", field: "wheat",
  ore: "ore", mountain: "ore",
  sheep: "sheep", wool: "sheep", pasture: "sheep",
};

// Canonical resource list (display order)
const RESOURCES = ["wood", "brick", "wheat", "ore", "sheep"];

// ── State ─────────────────────────────────────────────────────────────────────
let resourceTotals = {}; // { playerName: { wood: 0, brick: 0, ... } }

function initPlayer(name) {
  if (!resourceTotals[name]) {
    resourceTotals[name] = { wood: 0, brick: 0, wheat: 0, ore: 0, sheep: 0 };
  }
}

// ── Parsing ───────────────────────────────────────────────────────────────────

/**
 * Extract resource counts from a message DOM node.
 * colonist.io uses <img> tags with alt text or src paths containing the resource name.
 * Returns { wood: n, brick: n, ... } or null if not a resource gain message.
 */
function parseResourceMessage(node) {
  const text = node.innerText || node.textContent || "";

  // Only process "received" messages
  if (!text.toLowerCase().includes("received")) return null;

  // Extract player name — text before "received"
  const receivedMatch = text.match(/^(.+?)\s+received/i);
  if (!receivedMatch) return null;
  const playerName = receivedMatch[1].trim();

  // Count resources from <img> alt text or src
  const gains = { wood: 0, brick: 0, wheat: 0, ore: 0, sheep: 0 };
  let foundAny = false;

  const imgs = node.querySelectorAll("img");
  imgs.forEach((img) => {
    const alt = (img.alt || "").toLowerCase();
    const src = (img.src || "").toLowerCase();
    // Try alt text first, fall back to src filename
    const raw = alt || src.split("/").pop().replace(/\.[^.]+$/, "");
    const canonical = RESOURCE_ALIASES[raw];
    if (canonical) {
      gains[canonical]++;
      foundAny = true;
    }
  });

  // Fallback: parse plain text if no images found (e.g. "received: 2x wood, 1x ore")
  if (!foundAny) {
    const resourcePattern = /(\d+)x?\s*(wood|lumber|brick|clay|wheat|grain|ore|sheep|wool)/gi;
    let match;
    while ((match = resourcePattern.exec(text)) !== null) {
      const count = parseInt(match[1], 10);
      const canonical = RESOURCE_ALIASES[match[2].toLowerCase()];
      if (canonical) {
        gains[canonical] += count;
        foundAny = true;
      }
    }

    // Also handle "received: wood, ore" without counts (1 of each)
    if (!foundAny) {
      const singlePattern = /\b(wood|lumber|brick|clay|wheat|grain|ore|sheep|wool)\b/gi;
      while ((match = singlePattern.exec(text.split("received")[1] || "")) !== null) {
        const canonical = RESOURCE_ALIASES[match[1].toLowerCase()];
        if (canonical) {
          gains[canonical]++;
          foundAny = true;
        }
      }
    }
  }

  if (!foundAny) return null;
  return { playerName, gains };
}

/**
 * Process a single new message node from the game log.
 */
function processMessage(node) {
  const result = parseResourceMessage(node);
  if (!result) return;

  const { playerName, gains } = result;
  initPlayer(playerName);

  RESOURCES.forEach((r) => {
    resourceTotals[playerName][r] += gains[r];
  });

  persistState();
}

// ── Persistence ───────────────────────────────────────────────────────────────

function persistState() {
  chrome.storage.local.set({ resourceTotals });
}

function loadState() {
  chrome.storage.local.get("resourceTotals", (data) => {
    if (data.resourceTotals) {
      resourceTotals = data.resourceTotals;
    }
  });
}

// ── Observer ──────────────────────────────────────────────────────────────────

function attachObserver(container) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          processMessage(node);
        }
      });
    });
  });

  observer.observe(container, { childList: true, subtree: true });
  console.log("[CatanTracker] Observer attached to", container);
}

/**
 * colonist.io loads the game log asynchronously after the page loads.
 * Poll until the container appears, then attach the observer.
 */
function waitForChatContainer() {
  const container = document.querySelector(CHAT_CONTAINER_SELECTOR);
  if (container) {
    attachObserver(container);
    return;
  }
  // Retry every 500ms — game log typically appears within a few seconds
  setTimeout(waitForChatContainer, 500);
}

// ── Init ──────────────────────────────────────────────────────────────────────

loadState();
waitForChatContainer();

// Expose reset for popup to call if needed
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "RESET") {
    resourceTotals = {};
    persistState();
    sendResponse({ ok: true });
  }
  if (msg.type === "GET_STATE") {
    sendResponse({ resourceTotals });
  }
});
