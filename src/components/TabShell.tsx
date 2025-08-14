// components/TabShell.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Tab = { id: string; url: string; title?: string; active?: boolean };
type TabList = { activeTabId: string | null; list: Tab[] };
type OverlayPayload = {
  tabId: string;
  url: string;
  selection: string;
  rect: { left: number; top: number; width: number; height: number };
  viewBounds: { x: number; y: number; width: number; height: number };
  devicePixelRatio: number;
};

declare global {
  interface Window {
    orb?: {
      createTab: (url?: string) => Promise<string>;
      switchTab: (id: string) => Promise<string>;
      closeTab: (id: string) => Promise<boolean>;
      navigateTab: (id: string, url: string) => Promise<boolean>;
      reloadTab: (id: string) => Promise<boolean>;
      listTabs: () => Promise<TabList>;
      onTabsUpdate: (cb: (t: TabList) => void) => () => void;
      onOverlayShow: (cb: (p: OverlayPayload) => void) => () => void;
      onOverlayHide: (cb: () => void) => () => void;
      hideOverlay: () => void;
    };
  }
}

export default function TabShell() {
  const [tabs, setTabs] = useState<TabList>({ activeTabId: null, list: [] });
  const [overlay, setOverlay] = useState<OverlayPayload | null>(null);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const explainAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    let unsubTabs = () => {};
    let unsubOverlayShow = () => {};
    let unsubOverlayHide = () => {};

    (async () => {
      if (!window.orb) return;
      setTabs(await window.orb.listTabs());
      unsubTabs = window.orb.onTabsUpdate(setTabs);
      unsubOverlayShow = window.orb.onOverlayShow((payload) => setOverlay(payload));
      unsubOverlayHide = window.orb.onOverlayHide(() => setOverlay(null));
    })();

    return () => {
      unsubTabs();
      unsubOverlayShow();
      unsubOverlayHide();
      if (explainAbort.current) explainAbort.current.abort();
    };
  }, []);

  const active = useMemo(
    () => tabs.list.find((t) => t.id === tabs.activeTabId),
    [tabs]
  );

  const handleNewTab = async (url?: string) => {
    await window.orb?.createTab(url);
  };
  const handleCloseTab = async (id: string) => {
    await window.orb?.closeTab(id);
  };
  const handleSwitch = async (id: string) => {
    await window.orb?.switchTab(id);
  };
  const handleNavigate = async (id: string, url: string) => {
    await window.orb?.navigateTab(id, url);
  };

  const handleExplain = async () => {
    if (!overlay) return;
    try {
      setLoadingExplain(true);
      explainAbort.current = new AbortController();
      // Call your external API here
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: explainAbort.current.signal,
        body: JSON.stringify({
          text: overlay.selection,
          url: overlay.url,
          requestType: "explain",
        }),
      });
      const data = await res.json();
      alert(data.explanation || "No explanation."); // Replace with a nicer UI
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingExplain(false);
    }
  };

  const handleJotDown = () => {
    if (!overlay) return;
    // You can save to your notes store / backend here
    console.log("Jot down:", overlay.selection);
    window.orb?.hideOverlay();
  };

  // Position overlay: convert page coords to window coords by adding viewBounds offsets.
  const overlayStyle = overlay
    ? {
      position: "fixed" as const,
      top: Math.round(overlay.viewBounds.y + overlay.rect.top),
      left: Math.round(overlay.viewBounds.x + overlay.rect.left),
      zIndex: 10000,
    }
    : undefined;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center h-11 bg-gray-900 text-gray-200 border-b border-gray-800 px-2 gap-2">
        {tabs.list.map((t) => (
          <button
            key={t.id}
            onClick={() => handleSwitch(t.id)}
            className={`max-w-[240px] px-3 py-1 rounded-lg truncate ${
              t.active ? "bg-gray-700" : "hover:bg-gray-800"
            }`}
            title={t.url}
          >
            {t.title || t.url}
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleCloseTab(t.id);
              }}
              className="ml-2 text-gray-400 hover:text-white"
            >
              ×
            </span>
          </button>
        ))}
        <button
          onClick={() => handleNewTab("http://localhost:3000")}
          className="ml-1 px-2 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white"
        >
          + New Tab
        </button>

        {active && (
  <form
    className="ml-4 flex-1 flex"
    onSubmit={(e) => {
      e.preventDefault();
      if (active.url === "http://localhost:3000") return; // prevent navigating away
      const url = (e.currentTarget.elements.namedItem("u") as HTMLInputElement).value.trim();
      if (url) handleNavigate(active.id, url.startsWith("http") ? url : `https://${url}`);
    }}
  >
    <input
      name="u"
      defaultValue={active.url}
      readOnly={active.url === "http://localhost:3000"} // make read-only for your Next.js UI
      className={`flex-1 bg-gray-800 text-white rounded-l px-3 outline-none border border-gray-700 ${
        active.url === "http://localhost:3000" ? "cursor-not-allowed opacity-70" : ""
      }`}
      placeholder="Enter URL…"
    />
    <button
      disabled={active.url === "http://localhost:3000"}
      className={`px-3 bg-gray-700 border border-l-0 border-gray-700 rounded-r ${
        active.url === "http://localhost:3000" ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      Go
    </button>
  </form>
)}

      </div>

      {/* The BrowserView is drawn BEHIND this React tree, so we only render overlays or HUD on top */}
      {overlay && (
        <div style={overlayStyle}>
          <div className="translate-y-[-44px]">
            {/* little bubble above selection */}
            <div className="inline-flex items-center gap-2 bg-white text-gray-900 shadow-xl rounded-xl border px-3 py-2">
              <span className="max-w-[360px] truncate italic text-sm">
                “{overlay.selection.length > 100 ? overlay.selection.slice(0, 100) + "…" : overlay.selection}”
              </span>
              <button
                onClick={handleExplain}
                className="px-3 py-1 rounded bg-purple-600 text-white hover:bg-purple-700 text-sm"
                disabled={loadingExplain}
              >
                {loadingExplain ? "…" : "Explain"}
              </button>
              <button
                onClick={handleJotDown}
                className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
              >
                Jot down
              </button>
              <button
                onClick={() => window.orb?.hideOverlay()}
                className="px-2 py-1 rounded hover:bg-gray-100 text-sm"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Optional: a bottom HUD, status, etc. */}
    </div>
  );
}
