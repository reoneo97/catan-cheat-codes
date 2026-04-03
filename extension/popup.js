const RESOURCES = ["wood", "brick", "wheat", "ore", "sheep"];

const noDataEl = document.getElementById("no-data");
const trackerTableEl = document.getElementById("tracker-table");
const playerRowsEl = document.getElementById("player-rows");
const resetBtn = document.getElementById("reset-btn");

function renderTable(resourceTotals) {
  const players = Object.keys(resourceTotals);

  if (players.length === 0) {
    noDataEl.hidden = false;
    trackerTableEl.hidden = true;
    return;
  }

  noDataEl.hidden = true;
  trackerTableEl.hidden = false;
  playerRowsEl.innerHTML = "";

  // Sort players by total resources descending
  players
    .sort((a, b) => {
      const totalA = RESOURCES.reduce((s, r) => s + resourceTotals[a][r], 0);
      const totalB = RESOURCES.reduce((s, r) => s + resourceTotals[b][r], 0);
      return totalB - totalA;
    })
    .forEach((player) => {
      const counts = resourceTotals[player];
      const total = RESOURCES.reduce((s, r) => s + counts[r], 0);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="player-col">${escapeHtml(player)}</td>
        ${RESOURCES.map((r) => `<td>${counts[r] || 0}</td>`).join("")}
        <td class="total-col"><strong>${total}</strong></td>
      `;
      playerRowsEl.appendChild(tr);
    });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadAndRender() {
  chrome.storage.local.get("resourceTotals", (data) => {
    renderTable(data.resourceTotals || {});
  });
}

resetBtn.addEventListener("click", () => {
  // Send reset message to the active colonist.io tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "RESET" }, () => {
        loadAndRender();
      });
    } else {
      // No active tab — just clear storage directly
      chrome.storage.local.set({ resourceTotals: {} }, loadAndRender);
    }
  });
});

// Refresh display whenever storage changes (content script updates it live)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.resourceTotals) {
    renderTable(changes.resourceTotals.newValue || {});
  }
});

// Initial load
loadAndRender();
