/**
 * Generates the VMS user-manual PDF from the canonical Markdown source
 * (`src/content/manual.md`) rather than rasterising the rendered help page.
 *
 * The Markdown is the single source of truth for the document: edit `manual.md`
 * when the manual changes and the exported PDF follows automatically. Output is
 * real, selectable text (not an image), so the file stays small and searchable.
 *
 * jsPDF and marked are imported lazily so they only load when a user exports.
 */
import type { jsPDF as JsPdf } from 'jspdf';
import type { Token, Tokens } from 'marked';

/** Inline text styling carried down through marked's inline tokens. */
type Style = { bold?: boolean; italic?: boolean };
/** A styled run of inline text produced from marked's inline tokens. */
type Run = Style & { text: string };

// jsPDF's built-in Helvetica is WinAnsi-encoded, so a handful of common Unicode
// punctuation marks would render as garbage. Fold them to safe equivalents.
const sanitize = (s: string): string =>
  s
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/…/g, '...')
    .replace(/→/g, '->')
    .replace(/[–—]/g, '–') // en/em dash both exist in WinAnsi
    .replace(/\u00a0/g, ' '); // non-breaking space -> normal space

/** Flatten marked inline tokens into styled runs, dropping markup. */
function inlineRuns(tokens: Token[] | undefined, base: Style = {}): Run[] {
  const runs: Run[] = [];
  const walk = (toks: Token[], style: Style) => {
    for (const t of toks) {
      switch (t.type) {
        case 'strong':
          walk((t as Tokens.Strong).tokens, { ...style, bold: true });
          break;
        case 'em':
          walk((t as Tokens.Em).tokens, { ...style, italic: true });
          break;
        case 'link':
          walk((t as Tokens.Link).tokens, style);
          break;
        case 'codespan':
          runs.push({ ...style, text: sanitize((t as Tokens.Codespan).text) });
          break;
        case 'br':
          runs.push({ ...style, text: '\n' });
          break;
        default: {
          const inner = (t as { tokens?: Token[] }).tokens;
          if (inner && inner.length) walk(inner, style);
          else runs.push({ ...style, text: sanitize((t as Tokens.Text).text ?? '') });
        }
      }
    }
  };
  walk(tokens ?? [], base);
  return runs;
}

/** Pull the inline tokens out of a block (paragraph, list item, table cell). */
function blockInline(token: Token): Token[] {
  const t = token as { tokens?: Token[]; type?: string };
  if (t.type === 'list_item' || t.type === 'blockquote') {
    // Walk one level down to the first paragraph/text child.
    for (const child of t.tokens ?? []) {
      const c = child as { type?: string; tokens?: Token[] };
      if (c.type === 'text' || c.type === 'paragraph') return c.tokens ?? [];
    }
  }
  return t.tokens ?? [];
}

export async function generateManualPdf(): Promise<void> {
  const [{ jsPDF }, { marked }, mdModule] = await Promise.all([
    import('jspdf'),
    import('marked'),
    import('../content/manual.md?raw'),
  ]);

  const tokens = marked.lexer(mdModule.default);
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;
  const contentW = pageW - margin * 2;
  const maxY = pageH - 54; // keep clear of the footer strip
  const ink: [number, number, number] = [30, 41, 59]; // slate-800
  const muted: [number, number, number] = [100, 116, 139]; // slate-500
  const brand: [number, number, number] = [79, 70, 229]; // ~brand-600

  let y = margin;

  const setColor = ([r, g, b]: [number, number, number]) => doc.setTextColor(r, g, b);
  const newPage = () => {
    doc.addPage();
    y = margin;
  };
  const ensure = (h: number) => {
    if (y + h > maxY) newPage();
  };

  /** Lay out styled runs with word wrapping inside [x, x + width]. */
  const drawRuns = (
    runs: Run[],
    opts: {
      x: number;
      width: number;
      size: number;
      lineH: number;
      color: [number, number, number];
    },
  ) => {
    const { x, width, size, lineH } = opts;
    doc.setFontSize(size);
    setColor(opts.color);
    const fontFor = (r: Run) =>
      doc.setFont(
        'helvetica',
        r.bold && r.italic ? 'bolditalic' : r.bold ? 'bold' : r.italic ? 'italic' : 'normal',
      );

    // Expand runs into words while preserving style and explicit line breaks.
    type Word = { text: string; run: Run; w: number; break?: boolean };
    const words: Word[] = [];
    for (const r of runs) {
      const segments = r.text.split('\n');
      segments.forEach((seg, i) => {
        if (i > 0) words.push({ text: '', run: r, w: 0, break: true });
        for (const piece of seg.split(/(\s+)/)) {
          if (piece === '') continue;
          fontFor(r);
          words.push({ text: piece, run: r, w: doc.getTextWidth(piece) });
        }
      });
    }

    let lineWords: Word[] = [];
    let lineW = 0;
    const flush = () => {
      ensure(lineH);
      let cx = x;
      for (const w of lineWords) {
        fontFor(w.run);
        doc.text(w.text, cx, y);
        cx += w.w;
      }
      y += lineH;
      lineWords = [];
      lineW = 0;
    };
    for (const w of words) {
      if (w.break) {
        flush();
        continue;
      }
      // Don't start a line with whitespace.
      if (!lineWords.length && /^\s+$/.test(w.text)) continue;
      if (lineW + w.w > width && lineWords.length) flush();
      lineWords.push(w);
      lineW += w.w;
    }
    if (lineWords.length) flush();
  };

  const paragraph = (token: Token, indent = 0) => {
    drawRuns(inlineRuns(blockInline(token)), {
      x: margin + indent,
      width: contentW - indent,
      size: 10.5,
      lineH: 15,
      color: ink,
    });
    y += 7;
  };

  const heading = (token: Tokens.Heading) => {
    if (token.depth === 1) {
      y += 4;
      drawRuns(inlineRuns(token.tokens, { bold: true }), {
        x: margin,
        width: contentW,
        size: 22,
        lineH: 27,
        color: ink,
      });
      y += 14;
      return;
    }
    const size = token.depth === 2 ? 15 : 12;
    const lineH = token.depth === 2 ? 20 : 16;
    // Keep a heading with the first lines that follow it.
    ensure(lineH + 28);
    y += token.depth === 2 ? 14 : 8;
    drawRuns(inlineRuns(token.tokens, { bold: true }), {
      x: margin,
      width: contentW,
      size,
      lineH,
      color: token.depth === 2 ? brand : ink,
    });
    y += 6;
  };

  const list = (token: Tokens.List) => {
    token.items.forEach((item, i) => {
      const marker = token.ordered ? `${(token.start || 1) + i}.` : '•';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      const markerW = 18;
      const startY = y;
      // Draw the wrapped item body first, indented past the marker.
      drawRuns(inlineRuns(blockInline(item)), {
        x: margin + markerW,
        width: contentW - markerW,
        size: 10.5,
        lineH: 15,
        color: ink,
      });
      // Then the marker, aligned to the first body line.
      setColor(token.ordered ? ink : brand);
      doc.setFont('helvetica', token.ordered ? 'bold' : 'normal');
      doc.text(marker, margin + 2, startY);
      y += 3;
    });
    y += 6;
  };

  const blockquote = (token: Tokens.Blockquote) => {
    // Render as a left-bordered callout box.
    const innerInline = inlineRuns(blockInline(token));
    const padX = 12;
    const padY = 9;
    const startY = y;
    // Measure by laying out into a probe? Simpler: draw text, then backfill the
    // rule using the height consumed.
    y += padY;
    drawRuns(innerInline, {
      x: margin + padX,
      width: contentW - padX * 2,
      size: 10,
      lineH: 14.5,
      color: [51, 65, 85],
    });
    y += padY;
    // Accent bar down the left edge of the consumed block.
    doc.setFillColor(brand[0], brand[1], brand[2]);
    doc.rect(margin, startY, 3, y - startY, 'F');
    y += 9;
  };

  const table = (token: Tokens.Table) => {
    const cols = token.header.length;
    const ratios =
      cols === 2 ? [0.32, 0.68] : cols === 3 ? [0.26, 0.55, 0.19] : Array(cols).fill(1 / cols);
    const widths = ratios.map((r) => r * contentW);
    const padX = 6;
    const padY = 5;
    const size = 9.5;
    const lineH = 13;

    const cellLines = (text: string, w: number) => {
      doc.setFontSize(size);
      return doc.splitTextToSize(sanitize(text), w - padX * 2) as string[];
    };

    const drawRow = (cells: string[], opts: { headerRow?: boolean }) => {
      doc.setFont('helvetica', opts.headerRow ? 'bold' : 'normal');
      const linesPerCell = cells.map((c, i) => cellLines(c, widths[i]!));
      const rowLines = Math.max(...linesPerCell.map((l) => l.length), 1);
      const rowH = rowLines * lineH + padY * 2;
      ensure(rowH);
      const top = y;
      if (opts.headerRow) {
        doc.setFillColor(241, 245, 249); // slate-100
        doc.rect(margin, top, contentW, rowH, 'F');
      }
      let cx = margin;
      setColor(opts.headerRow ? ink : [51, 65, 85]);
      linesPerCell.forEach((lines, i) => {
        let ty = top + padY + lineH - 3;
        for (const ln of lines) {
          doc.text(ln, cx + padX, ty);
          ty += lineH;
        }
        cx += widths[i]!;
      });
      // Row separator.
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.5);
      doc.line(margin, top + rowH, margin + contentW, top + rowH);
      y = top + rowH;
    };

    ensure(lineH * 2);
    y += 4;
    // Top border.
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + contentW, y);
    drawRow(
      token.header.map((c) => c.text),
      { headerRow: true },
    );
    for (const row of token.rows) {
      drawRow(
        row.map((c) => c.text),
        {},
      );
    }
    y += 10;
  };

  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        heading(token as Tokens.Heading);
        break;
      case 'paragraph':
        paragraph(token);
        break;
      case 'list':
        list(token as Tokens.List);
        break;
      case 'blockquote':
        blockquote(token as Tokens.Blockquote);
        break;
      case 'table':
        table(token as Tokens.Table);
        break;
      case 'hr':
        ensure(16);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(margin, y + 6, margin + contentW, y + 6);
        y += 16;
        break;
      case 'space':
        y += 4;
        break;
      default:
        break;
    }
  }

  // Footer: "VMS User manual" left, page x / y right, on every page.
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setColor(muted);
    doc.text('VMS User manual', margin, pageH - 28);
    doc.text(`${i} / ${total}`, pageW - margin, pageH - 28, { align: 'right' });
  }

  doc.save('VMS-User-Manual.pdf');
}

export type { JsPdf };
