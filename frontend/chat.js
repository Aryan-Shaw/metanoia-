

(function chatWidget() {
  const toggleBtn = document.getElementById("chat-toggle-btn");
  const panel = document.getElementById("chat-panel");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send");
  const messagesEl = document.getElementById("chat-messages");

  if (!toggleBtn || !panel || !form || !input || !messagesEl) {
    console.warn("Chat widget: one or more expected elements were not found in the DOM.");
    return;
  }

  let isOpen = false;
  let loading = false;

  showEmptyState();

  toggleBtn.addEventListener("click", () => {
    isOpen = !isOpen;
    panel.classList.toggle("open", isOpen);
    toggleBtn.setAttribute("aria-expanded", String(isOpen));
    window.dispatchEvent(new CustomEvent("pathfind:chattoggle", { detail: { open: isOpen } }));
    if (isOpen) input.focus();
  });

  function showEmptyState() {
    if (messagesEl.children.length > 0) return;
    const hint = document.createElement("div");
    hint.className = "messages-empty";
    hint.textContent = "Ask me anything about career paths.";
    messagesEl.appendChild(hint);
  }

  function clearEmptyState() {
    const hint = messagesEl.querySelector(".messages-empty");
    if (hint) hint.remove();
  }

  function addMessage(text, sender) {
    clearEmptyState();
    const div = document.createElement("div");
    div.className = `msg ${sender}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    window.dispatchEvent(new CustomEvent("pathfind:chatmessage", { detail: { el: div, sender } }));
    return div;
  }

  function setLoading(next) {
    loading = next;
    input.disabled = loading;
    sendBtn.disabled = loading;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question || loading) return;

    addMessage(question, "user");
    input.value = "";
    setLoading(true);

    const thinkingEl = addMessage("Thinking...", "bot");

    try {
      const res = await fetch(`/api/chat?question=${encodeURIComponent(question)}`);
      const data = await res.json();

      if (!res.ok) {
        thinkingEl.className = "msg error";
        thinkingEl.textContent = data.error || "Something went wrong. Please try again.";
      } else {
        thinkingEl.textContent = data.responseai;
      }
    } catch (err) {
      thinkingEl.className = "msg error";
      thinkingEl.textContent = "Something went wrong. Please try again.";
    } finally {
      setLoading(false);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });
})();