
// const API_URL = "http://localhost:3000/api/explain"; // your Next.js API

// function getSelectionRect() {
//   const selection = window.getSelection();
//   if (!selection || selection.rangeCount === 0) return null;
//   const range = selection.getRangeAt(0).cloneRange();
//   const rect = range.getBoundingClientRect();
//   if (rect.width === 0 && rect.height === 0) return null;
//   return rect;
// }

// function createOverlay() {
//   let overlay = document.getElementById("orb-injected-overlay");
//   if (!overlay) {
//     overlay = document.createElement("div");
//     overlay.id = "orb-injected-overlay";
//     overlay.style.position = "absolute";
//     overlay.style.background = "white";
//     overlay.style.border = "1px solid #ccc";
//     overlay.style.padding = "6px 10px";
//     overlay.style.borderRadius = "6px";
//     overlay.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
//     overlay.style.zIndex = 999999;
//     overlay.style.maxWidth = "320px";
//     overlay.style.fontSize = "14px";
//     overlay.style.lineHeight = "1.4";
//     overlay.style.cursor = "default";
//     document.body.appendChild(overlay);
//   }
//   return overlay;
// }

// function showOverlay(text, rect) {
//   const overlay = createOverlay();
//   overlay.innerHTML = `
//     <div style="font-style: italic; margin-bottom: 4px;">
//       “${text.length > 100 ? text.slice(0, 100) + "…" : text}”
//     </div>
//     <button id="orb-explain-btn" style="
//       background: purple;
//       color: white;
//       border: none;
//       padding: 4px 8px;
//       border-radius: 4px;
//       cursor: pointer;
//     ">Explain</button>
//     <div id="orb-explain-output" style="margin-top:6px;"></div>
//   `;

//   overlay.style.top = `${window.scrollY + rect.bottom + 6}px`;
//   overlay.style.left = `${window.scrollX + rect.left}px`;

//   document.getElementById("orb-explain-btn").onclick = async () => {
//     const output = document.getElementById("orb-explain-output");
//     output.textContent = "Loading…";
//     try {
//       const res = await fetch(API_URL, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           text,
//           url: window.location.href,
//           requestType: "explain",
//         }),
//       });
//       const data = await res.json();
//       output.textContent = data.explanation || "No explanation found.";
//     } catch (err) {
//       output.textContent = "Error fetching explanation.";
//     }
//   };
// }

// window.addEventListener("mouseup", () => {
//   setTimeout(() => {
//     const text = (window.getSelection()?.toString() || "").trim();
//     if (!text) return;
//     const rect = getSelectionRect();
//     if (!rect) return;
//     showOverlay(text, rect);
//   }, 0);
// });

// ===== ORB highlight → overlay → /api/explain =====
const API_URL = "http://localhost:3000/api/explain"; // your Next.js API

function getSelectionRect() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0).cloneRange();
  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) return null;
  return rect;
}

function buildPageContext() {
  const desc =
    document.querySelector('meta[name="description"]')?.content || "";
  // Keep this cheap—avoid huge bodies
  const content = (document.body?.innerText || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);

  return {
    title: document.title || "",
    url: window.location.href,
    description: desc,
    content,
  };
}

function createOverlay() {
  let overlay = document.getElementById("orb-injected-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "orb-injected-overlay";
    overlay.style.position = "absolute";
    overlay.style.background = "white";
    overlay.style.border = "1px solid #ccc";
    overlay.style.padding = "10px 12px 12px";
    overlay.style.borderRadius = "8px";
    overlay.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    overlay.style.zIndex = "2147483647";
    overlay.style.maxWidth = "360px";
    overlay.style.fontSize = "14px";
    overlay.style.lineHeight = "1.45";
    overlay.style.cursor = "default";
    overlay.style.userSelect = "text";
    overlay.style.backdropFilter = "saturate(1.2)";
    document.body.appendChild(overlay);
  }
  return overlay;
}

function showOverlay(text, rect) {
  const overlay = createOverlay();
  overlay.replaceChildren(); // clear

  // Close button (×)
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  Object.assign(closeBtn.style, {
    position: "absolute",
    top: "6px",
    right: "8px",
    background: "transparent",
    border: "none",
    fontSize: "18px",
    lineHeight: "18px",
    cursor: "pointer",
    color: "#444",
  });
  closeBtn.onclick = () => overlay.remove();

  // Title
  const titleEl = document.createElement("div");
  titleEl.textContent = "Explain selection";
  titleEl.style.fontWeight = "600";
  titleEl.style.marginBottom = "6px";

  // Quoted selection
  const quoteEl = document.createElement("div");
  quoteEl.style.fontStyle = "italic";
  quoteEl.style.marginBottom = "8px";
  quoteEl.style.color = "#111";
  quoteEl.textContent =
    "“" + (text.length > 160 ? text.slice(0, 160) + "…" : text) + "”";

  // Buttons bar
  const btnBar = document.createElement("div");
  btnBar.style.display = "flex";
  btnBar.style.gap = "8px";
  btnBar.style.alignItems = "center";
  btnBar.style.marginTop = "4px";

  const explainBtn = document.createElement("button");
  explainBtn.textContent = "Explain";
  Object.assign(explainBtn.style, {
    background: "purple",
    color: "white",
    border: "none",
    padding: "6px 10px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
  });

  const output = document.createElement("div");
  output.id = "orb-explain-output";
  output.style.marginTop = "8px";
  output.style.whiteSpace = "pre-wrap";

  btnBar.appendChild(explainBtn);

  overlay.appendChild(closeBtn);
  overlay.appendChild(titleEl);
  overlay.appendChild(quoteEl);
  overlay.appendChild(btnBar);
  overlay.appendChild(output);

  // Position slightly below the selection
  overlay.style.top = `${window.scrollY + rect.bottom + 8}px`;
  overlay.style.left = `${window.scrollX + rect.left}px`;

  // Fetch -> /api/explain with expected shape
  explainBtn.onclick = async () => {
    output.textContent = "Loading…";
    explainBtn.disabled = true;
    const originalLabel = explainBtn.textContent;
    explainBtn.textContent = "Explaining…";

    try {
      const payload = {
        selectedText: text,
        pageContext: buildPageContext(),
        requestType: "explain",
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        output.textContent =
          data.explanation || "No explanation generated.";
      } else {
        output.textContent = data.error
          ? `Error: ${data.error}`
          : `Error: ${res.status}`;
      }
    } catch (err) {
      output.textContent = "Error fetching explanation.";
    } finally {
      explainBtn.disabled = false;
      explainBtn.textContent = originalLabel;
    }
  };
}

// Show overlay on mouse selection
window.addEventListener("mouseup", () => {
  setTimeout(() => {
    const text = (window.getSelection()?.toString() || "").trim();
    if (!text) return;
    const rect = getSelectionRect();
    if (!rect) return;
    showOverlay(text, rect);
  }, 0);
});
