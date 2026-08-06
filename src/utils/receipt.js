// Draws an order receipt onto a canvas so it can be previewed, printed or saved
// as a PNG. Everything is generated in the browser - no server or library needed.

const WIDTH = 576; // 80mm thermal paper at 203dpi
const PAD = 28;
const SCALE = 2; // rendered at 2x so print and retina screens stay sharp
const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

// "Rs." rather than the rupee glyph: it renders identically everywhere,
// including on thermal printers with limited fonts.
const money = (n) => `Rs. ${Number(n || 0).toFixed(2)}`;

const stamp = (iso) =>
  new Date(iso || Date.now()).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Paints the receipt and returns the y of the last baseline. Called twice: once
 * on a throwaway context to learn the exact height, then on the real canvas.
 */
function paint(ctx, order, height) {
  const nameWidth = WIDTH - PAD * 2 - 130; // reserve the right column for amounts

  ctx.font = `24px ${FONT}`;
  const lines = order.items.map((item) => ({
    item,
    nameLines: wrap(ctx, `${item.quantity} x ${item.name}`, nameWidth),
    noteLines: item.notes ? wrap(ctx, `- ${item.notes}`, nameWidth) : [],
  }));

  const orderNoteLines = order.notes
    ? wrap(ctx, `Note: ${order.notes}`, WIDTH - PAD * 2)
    : [];

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.fillStyle = "#1d1a17";

  let y = 0;

  const divider = (dashed = true) => {
    y += 18;
    ctx.save();
    ctx.strokeStyle = "#bdb4a8";
    ctx.lineWidth = 1;
    ctx.setLineDash(dashed ? [5, 5] : []);
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(WIDTH - PAD, y);
    ctx.stroke();
    ctx.restore();
    y += 24;
  };

  const centered = (text, font, color = "#1d1a17") => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(text, WIDTH / 2, y);
    ctx.textAlign = "left";
    ctx.fillStyle = "#1d1a17";
  };

  const row = (label, value, font = `22px ${FONT}`, valueFont = font) => {
    ctx.font = font;
    ctx.fillText(label, PAD, y);
    ctx.font = valueFont;
    ctx.textAlign = "right";
    ctx.fillText(value, WIDTH - PAD, y);
    ctx.textAlign = "left";
  };

  // ---- header ----
  y = 52;
  centered("TRIO CAFE", `bold 42px ${FONT}`);
  y += 36;
  centered("Order Receipt", `22px ${FONT}`, "#7d746a");
  y += 30;
  centered("Thanks for dining with us", `18px ${FONT}`, "#7d746a");

  divider();

  // ---- meta ----
  row("Order No.", order.orderNumber, `22px ${FONT}`, `bold 22px ${FONT}`);
  y += 34;
  row("Date", stamp(order.createdAt), `20px ${FONT}`, `bold 20px ${FONT}`);
  y += 34;
  row("Table", String(order.tableNumber), `20px ${FONT}`, `bold 20px ${FONT}`);

  divider();

  // ---- items ----
  ctx.font = `bold 18px ${FONT}`;
  ctx.fillStyle = "#7d746a";
  ctx.fillText("ITEM", PAD, y);
  ctx.textAlign = "right";
  ctx.fillText("AMOUNT", WIDTH - PAD, y);
  ctx.textAlign = "left";
  ctx.fillStyle = "#1d1a17";
  y += 18;

  divider();

  lines.forEach(({ item, nameLines, noteLines }) => {
    nameLines.forEach((text, index) => {
      ctx.font = `28px ${FONT}`;
      ctx.fillText(text, PAD, y);
      if (index === 0) {
        ctx.font = `28px ${FONT}`;
        ctx.textAlign = "right";
        ctx.fillText(money(item.price * item.quantity), WIDTH - PAD, y);
        ctx.textAlign = "left";
      }
      y += 40;
    });

    noteLines.forEach((text) => {
      ctx.font = `italic 20px ${FONT}`;
      ctx.fillStyle = "#7d746a";
      ctx.fillText(text, PAD + 14, y);
      ctx.fillStyle = "#1d1a17";
      y += 28;
    });

    y += 12;
  });

  divider();

  // ---- totals ----
  row("Subtotal", money(order.subtotal), `28px ${FONT}`);
  y += 44;

  divider(false);

  row("TOTAL", money(order.total), `bold 44px ${FONT}`);
  y += 32;

  if (orderNoteLines.length) {
    divider();
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = "#7d746a";
    orderNoteLines.forEach((text) => {
      ctx.fillText(text, PAD, y);
      y += 24;
    });
    ctx.fillStyle = "#1d1a17";
  }

  divider();

  y += 10;
  centered("Visit again!", `bold 24px ${FONT}`);
  y += 28;
  centered("This is a computer generated receipt", `18px ${FONT}`, "#7d746a");

  return y;
}

export function buildReceiptCanvas(order) {
  // Pass one: measure. Nothing here is ever shown.
  const gauge = document.createElement("canvas").getContext("2d");
  const height = Math.ceil(paint(gauge, order, 0) + PAD);

  // Pass two: the real thing, now that the height is known exactly.
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  paint(ctx, order, height);

  return canvas;
}

export const receiptDataUrl = (order) =>
  buildReceiptCanvas(order).toDataURL("image/png");

export function downloadReceipt(order) {
  const link = document.createElement("a");
  link.href = receiptDataUrl(order);
  link.download = `${order.orderNumber}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

const ANDROID_PRINT_APP = {
  action: "android.intent.action.SEND",
  mimeType: "text/plain",
};

function isAndroidBrowser() {
  return (
    typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)
  );
}

export function buildReceiptText(order) {
  const lines = [
    "TRIO CAFE",
    "Order Receipt",
    "",
    `Order No.: ${order.orderNumber}`,
    `Date: ${stamp(order.createdAt)}`,
    `Table: ${order.tableNumber}`,
    "",
    "ITEM                                  AMOUNT",
    "-------------------------------------------",
  ];

  order.items.forEach((item) => {
    lines.push(`${item.quantity} x ${item.name}`);
    lines.push(`  ${money(item.price * item.quantity)}`);
    if (item.notes) {
      lines.push(`  Note: ${item.notes}`);
    }
  });

  lines.push("");
  lines.push(`Subtotal: ${money(order.subtotal)}`);
  lines.push(`TOTAL: ${money(order.total)}`);

  if (order.notes) {
    lines.push("");
    lines.push(`Note: ${order.notes}`);
  }

  lines.push("");
  lines.push("Visit again!");
  lines.push("This is a computer generated receipt");

  return lines.join("\n");
}

export function launchAndroidPrinterApp(order) {
  if (!isAndroidBrowser()) return false;

  const text = buildReceiptText(order);
  const encodedText = encodeURIComponent(text);
  const intentUrl = `intent:#Intent;action=${ANDROID_PRINT_APP.action};category=android.intent.category.DEFAULT;type=${ANDROID_PRINT_APP.mimeType};S.android.intent.extra.TEXT=${encodedText};end`;

  window.location.href = intentUrl;
  return true;
}

/**
 * Prints the receipt image from a hidden iframe, which avoids the popup
 * blocking that window.open() runs into.
 */
export function printReceipt(order) {
  const dataUrl = receiptDataUrl(order);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html>
<html>
  <head>
    <title>${order.orderNumber}</title>
    <style>
      @page { margin: 6mm; }
      html, body { margin: 0; padding: 0; }
      img { display: block; width: 100%; max-width: none; margin: 0 auto; }
    </style>
  </head>
  <body><img src="${dataUrl}" alt="Receipt ${order.orderNumber}" /></body>
</html>`);
  doc.close();

  const image = doc.querySelector("img");
  const run = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    // Give the print dialog time to take its snapshot before cleanup.
    setTimeout(() => frame.remove(), 1000);
  };

  if (image.complete) run();
  else image.onload = run;
}
