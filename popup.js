const enabledInput = document.getElementById("enabled");
const statusText = document.getElementById("status");

chrome.storage.sync.get({ enabled: true }, (items) => {
  enabledInput.checked = items.enabled;
  updateStatus(items.enabled);
});

enabledInput.addEventListener("change", () => {
  const enabled = enabledInput.checked;
  chrome.storage.sync.set({ enabled });
  updateStatus(enabled);
});

function updateStatus(enabled) {
  statusText.textContent = enabled ? "On" : "Off";
}
