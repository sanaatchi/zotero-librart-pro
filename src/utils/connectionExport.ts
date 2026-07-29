import { config } from "../../package.json";

export { exportConnectionMapSvg, exportConnectionMapPng };

function getSvg(win: Window): SVGSVGElement | null {
  const canvas = win.document.getElementById(
    `${config.addonRef}-connection-map-canvas`,
  );
  if (!canvas) return null;
  return canvas.querySelector("svg") as SVGSVGElement | null;
}

function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  const css = `
    .node-label { fill: #e8eaed; font-size: 11px; font-weight: 500;
      paint-order: stroke fill; stroke: #1c1c1e; stroke-width: 3px; }
  `;
  const style = svg.ownerDocument.createElementNS(
    "http://www.w3.org/2000/svg",
    "style",
  );
  style.textContent = css;
  clone.insertBefore(style, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}

function downloadBlob(win: Window, blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = win.document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  win.document.body.appendChild(a);
  a.click();
  a.remove();
  win.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportConnectionMapSvg(win: Window): boolean {
  const svg = getSvg(win);
  if (!svg) return false;
  const xml = serializeSvg(svg);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(win, blob, `baglanti-haritasi-${stamp}.svg`);
  return true;
}

function exportConnectionMapPng(win: Window): boolean {
  const svg = getSvg(win);
  if (!svg) return false;
  const xml = serializeSvg(svg);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new win.Image();
  img.onload = () => {
    try {
      const canvas = win.document.createElement("canvas");
      const w = Math.max(svg.clientWidth || 1280, 800);
      const h = Math.max(svg.clientHeight || 720, 600);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#1c1c1e";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((png) => {
        if (!png) return;
        const stamp = new Date().toISOString().slice(0, 10);
        downloadBlob(win, png, `baglanti-haritasi-${stamp}.png`);
      }, "image/png");
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
  return true;
}
