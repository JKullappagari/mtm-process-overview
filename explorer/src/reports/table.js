// Shared report building blocks.

/** heads: [{t:'Label', n:true if numeric}] ; body: pre-rendered <tr> rows. */
export const table = (heads, body) =>
  `<div style="overflow-x:auto"><table><thead><tr>${heads.map(h => `<th${h.n ? ' class="n"' : ''}>${h.t}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;

/** Row of headline figures. items: [[label, value, highlight?]] */
export const callbox = items =>
  `<div class="callbox">${items.map(([l, v, hl]) => `<div${hl ? ' class="hl"' : ''}><span>${l}</span><b>${v}</b></div>`).join('')}</div>`;
