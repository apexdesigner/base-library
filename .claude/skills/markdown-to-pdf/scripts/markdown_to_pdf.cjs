#!/usr/bin/env node

/**
 * Markdown to PDF Converter
 *
 * Purpose: Convert markdown files to PDF documents for property analysis reports,
 * financial summaries, and other documentation.
 *
 * Usage:
 *     node markdown_to_pdf.cjs <input.md> [output.pdf]
 *
 *     Or import as a module:
 *     const { convertMarkdownToPdf } = require('./markdown_to_pdf.cjs');
 *
 * Dependencies:
 *     npm install pdfmake@0.3 marked
 */

const pdfmake = require('pdfmake');
const { marked } = require('marked');
const path = require('path');
const fs = require('fs');

/**
 * Font definitions for pdfmake
 * Using standard PDF fonts (no external font files required)
 */
const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  },
  Courier: {
    normal: 'Courier',
    bold: 'Courier-Bold',
    italics: 'Courier-Oblique',
    bolditalics: 'Courier-BoldOblique'
  }
};

// Configure pdfmake with fonts
pdfmake.setFonts(fonts);

/**
 * Default document styles
 */
const DEFAULT_STYLES = {
  h1: {
    fontSize: 22,
    bold: true,
    color: '#1a1a1a',
    margin: [0, 20, 0, 10]
  },
  h2: {
    fontSize: 18,
    bold: true,
    color: '#2c3e50',
    margin: [0, 16, 0, 8]
  },
  h3: {
    fontSize: 14,
    bold: true,
    color: '#34495e',
    margin: [0, 12, 0, 6]
  },
  h4: {
    fontSize: 12,
    bold: true,
    color: '#34495e',
    margin: [0, 10, 0, 4]
  },
  paragraph: {
    fontSize: 11,
    lineHeight: 1.4,
    margin: [0, 0, 0, 8]
  },
  code: {
    font: 'Courier',
    fontSize: 9,
    background: '#f4f4f4',
    color: '#1f2937',
    margin: [0, 4, 0, 8]
  },
  blockquote: {
    fontSize: 11,
    italics: true,
    color: '#666666',
    margin: [20, 4, 0, 8]
  },
  listItem: {
    fontSize: 11,
    lineHeight: 1.3,
    margin: [0, 2, 0, 2]
  },
  tableHeader: {
    bold: true,
    fontSize: 10,
    fillColor: '#f5f5f5'
  },
  tableCell: {
    fontSize: 10
  },
  link: {
    color: '#2563eb',
    decoration: 'underline'
  }
};

/**
 * Convert markdown tokens to pdfmake content
 */
class MarkdownToPdfmake {
  constructor(options = {}) {
    this.styles = { ...DEFAULT_STYLES, ...options.styles };
  }

  /**
   * Convert markdown string to pdfmake document definition
   */
  convert(markdown) {
    const tokens = marked.lexer(markdown);
    const content = this.processTokens(tokens);

    return {
      content,
      styles: this.styles,
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 11,
        lineHeight: 1.4
      },
      pageSize: 'LETTER',
      pageMargins: [72, 72, 72, 72]  // 1 inch margins
    };
  }

  /**
   * Process array of tokens
   */
  processTokens(tokens) {
    const content = [];

    for (const token of tokens) {
      const result = this.processToken(token);
      if (result !== null) {
        if (Array.isArray(result) && result.length > 0 && !result.table && !result.ul && !result.ol) {
          content.push(...result);
        } else {
          content.push(result);
        }
      }
    }

    return content;
  }

  /**
   * Process a single token
   */
  processToken(token) {
    switch (token.type) {
      case 'heading':
        return this.processHeading(token);
      case 'paragraph':
        return this.processParagraph(token);
      case 'list':
        return this.processList(token);
      case 'code':
        return this.processCodeBlock(token);
      case 'blockquote':
        return this.processBlockquote(token);
      case 'hr':
        return this.processHorizontalRule();
      case 'table':
        return this.processTable(token);
      case 'space':
        return null;
      case 'html':
        // Try to extract text from simple HTML
        const text = token.text.replace(/<[^>]*>/g, '').trim();
        return text ? { text, style: 'paragraph' } : null;
      default:
        if (token.text) {
          return { text: token.text, style: 'paragraph' };
        }
        return null;
    }
  }

  /**
   * Process heading
   */
  processHeading(token) {
    const style = `h${Math.min(token.depth, 4)}`;
    const text = this.processInlineTokens(token.tokens || []);

    const heading = {
      text,
      style
    };

    // Add underline for h1 and h2
    if (token.depth === 1) {
      return [
        heading,
        {
          canvas: [{
            type: 'line',
            x1: 0, y1: 0,
            x2: 468, y2: 0,  // Full width minus margins
            lineWidth: 1.5,
            lineColor: '#333333'
          }],
          margin: [0, 0, 0, 8]
        }
      ];
    } else if (token.depth === 2) {
      return [
        heading,
        {
          canvas: [{
            type: 'line',
            x1: 0, y1: 0,
            x2: 468, y2: 0,
            lineWidth: 0.5,
            lineColor: '#cccccc'
          }],
          margin: [0, 0, 0, 6]
        }
      ];
    }

    return heading;
  }

  /**
   * Process paragraph
   */
  processParagraph(token) {
    const text = this.processInlineTokens(token.tokens || []);
    return {
      text,
      style: 'paragraph'
    };
  }

  /**
   * Process inline tokens (bold, italic, code, links)
   */
  processInlineTokens(tokens) {
    if (!tokens || tokens.length === 0) {
      return '';
    }

    const result = [];

    for (const token of tokens) {
      switch (token.type) {
        case 'text':
          result.push(token.text);
          break;
        case 'strong':
          result.push({
            text: this.processInlineTokens(token.tokens || [{ type: 'text', text: token.text }]),
            bold: true
          });
          break;
        case 'em':
          result.push({
            text: this.processInlineTokens(token.tokens || [{ type: 'text', text: token.text }]),
            italics: true
          });
          break;
        case 'codespan':
          result.push({
            text: token.text,
            font: 'Courier',
            fontSize: 9,
            background: '#f0f0f0'
          });
          break;
        case 'link':
          result.push({
            text: token.text,
            link: token.href,
            color: '#2563eb',
            decoration: 'underline'
          });
          break;
        case 'br':
          result.push('\n');
          break;
        case 'html':
          // Handle inline HTML like <sup>
          const match = token.raw.match(/<sup>\[?(\d+)\]?<\/sup>/);
          if (match) {
            result.push({
              text: `[${match[1]}]`,
              fontSize: 8,
              sup: true
            });
          }
          break;
        default:
          if (token.text) {
            result.push(token.text);
          } else if (token.raw) {
            result.push(token.raw);
          }
      }
    }

    return result;
  }

  /**
   * Process list (ordered or unordered)
   */
  processList(token) {
    const items = token.items.map(item => this.processListItem(item));

    if (token.ordered) {
      return {
        ol: items,
        margin: [0, 4, 0, 8]
      };
    } else {
      return {
        ul: items,
        margin: [0, 4, 0, 8]
      };
    }
  }

  /**
   * Process list item
   */
  processListItem(item) {
    const content = [];

    if (item.tokens) {
      for (const token of item.tokens) {
        if (token.type === 'text') {
          content.push(...this.processInlineTokens(token.tokens || [{ type: 'text', text: token.text }]));
        } else if (token.type === 'paragraph') {
          content.push(...this.processInlineTokens(token.tokens || []));
        } else if (token.type === 'list') {
          // Nested list - return as separate item
          return {
            stack: [
              { text: content, style: 'listItem' },
              this.processList(token)
            ]
          };
        }
      }
    } else if (item.text) {
      content.push(item.text);
    }

    return { text: content, style: 'listItem' };
  }

  /**
   * Process code block
   */
  processCodeBlock(token) {
    return {
      text: token.text,
      style: 'code',
      preserveLeadingSpaces: true
    };
  }

  /**
   * Process blockquote
   */
  processBlockquote(token) {
    const content = [];

    if (token.tokens) {
      for (const t of token.tokens) {
        const result = this.processToken(t);
        if (result) {
          if (Array.isArray(result)) {
            content.push(...result);
          } else {
            content.push(result);
          }
        }
      }
    }

    return {
      stack: content,
      style: 'blockquote',
      margin: [15, 4, 0, 8],
      border: [true, false, false, false],
      borderColor: ['#3498db', null, null, null]
    };
  }

  /**
   * Process horizontal rule
   */
  processHorizontalRule() {
    return {
      canvas: [{
        type: 'line',
        x1: 0, y1: 0,
        x2: 468, y2: 0,
        lineWidth: 1,
        lineColor: '#cccccc'
      }],
      margin: [0, 10, 0, 10]
    };
  }

  /**
   * Process table
   */
  processTable(token) {
    const { header, rows } = token;

    // Build header row
    const headerRow = header.map(cell => ({
      text: this.processInlineTokens(cell.tokens || [{ type: 'text', text: cell.text }]),
      style: 'tableHeader',
      fillColor: '#f5f5f5'
    }));

    // Build body rows
    const bodyRows = rows.map(row =>
      row.map(cell => ({
        text: this.processInlineTokens(cell.tokens || [{ type: 'text', text: cell.text }]),
        style: 'tableCell'
      }))
    );

    // Calculate column widths (equal distribution)
    const colCount = header.length;
    const widths = Array(colCount).fill('*');

    return {
      table: {
        headerRows: 1,
        widths,
        body: [headerRow, ...bodyRows]
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#d1d5db',
        vLineColor: () => '#d1d5db',
        paddingLeft: () => 6,
        paddingRight: () => 6,
        paddingTop: () => 4,
        paddingBottom: () => 4
      },
      margin: [0, 8, 0, 12]
    };
  }
}

/**
 * Convert a markdown file to PDF.
 *
 * @param {string} inputPath - Path to the markdown file
 * @param {string} [outputPath] - Path for output PDF (defaults to same name with .pdf extension)
 * @param {Object} [options] - Additional options
 * @returns {Promise<{filename: string, content: Buffer}>} Result object with filename and PDF buffer
 */
async function convertMarkdownToPdf(inputPath, outputPath = null, options = {}) {
  // Validate input file exists
  const absoluteInputPath = path.resolve(inputPath);
  if (!fs.existsSync(absoluteInputPath)) {
    throw new Error(`Input file not found: ${absoluteInputPath}`);
  }

  // Read markdown content
  const markdown = fs.readFileSync(absoluteInputPath, 'utf8');

  // Determine output path
  if (!outputPath) {
    const parsedPath = path.parse(absoluteInputPath);
    outputPath = path.join(parsedPath.dir, `${parsedPath.name}.pdf`);
  }
  const absoluteOutputPath = path.resolve(outputPath);

  return convertMarkdownStringToPdf(markdown, absoluteOutputPath, options);
}

/**
 * Convert markdown string content to PDF.
 *
 * @param {string} markdownContent - Markdown content as string
 * @param {string} outputPath - Path for output PDF
 * @param {Object} [options] - Additional options
 * @returns {Promise<{filename: string, content: Buffer}>} Result object with filename and PDF buffer
 */
async function convertMarkdownStringToPdf(markdownContent, outputPath, options = {}) {
  const absoluteOutputPath = path.resolve(outputPath);

  // Convert markdown to pdfmake document definition
  const converter = new MarkdownToPdfmake(options);
  const docDefinition = converter.convert(markdownContent);

  try {
    // Create PDF using pdfmake 0.3.x API
    const pdfDoc = pdfmake.createPdf(docDefinition);

    // Write to file using the new promise-based API
    await pdfDoc.write(absoluteOutputPath);

    // Read the file back to get the buffer for the return value
    const content = fs.readFileSync(absoluteOutputPath);

    console.log(`✓ PDF created: ${absoluteOutputPath}`);
    return {
      filename: absoluteOutputPath,
      content
    };
  } catch (error) {
    throw new Error(`Failed to convert markdown to PDF: ${error.message}`);
  }
}

/**
 * Get available page formats.
 * @returns {string[]} List of supported page formats
 */
function getPageFormats() {
  return ['LETTER', 'A4', 'LEGAL', 'TABLOID'];
}

/**
 * Command-line interface
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Markdown to PDF Converter
=========================

Usage:
  node markdown_to_pdf.js <input.md> [output.pdf] [options]

Arguments:
  input.md      Path to the markdown file to convert
  output.pdf    Output PDF path (optional, defaults to input filename with .pdf)

Options:
  --help, -h    Show this help message

Examples:
  node markdown_to_pdf.js report.md
  node markdown_to_pdf.js report.md output/report.pdf

Supported Features:
  - Headings (h1-h4 with underlines for h1/h2)
  - Bold, italic, inline code
  - Links (clickable)
  - Ordered and unordered lists (nested)
  - Code blocks
  - Blockquotes
  - Tables
  - Horizontal rules
`);
    process.exit(0);
  }

  // Parse arguments
  const inputPath = args.find(arg => !arg.startsWith('--'));
  const outputArg = args.find((arg, i) => !arg.startsWith('--') && i > 0);

  if (!inputPath) {
    console.error('Error: Input file path is required');
    process.exit(1);
  }

  try {
    const result = await convertMarkdownToPdf(inputPath, outputArg);
    console.log(`\nConversion complete!`);
    console.log(`Output: ${result.filename}`);
    console.log(`Size: ${(result.content.length / 1024).toFixed(1)} KB`);
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  }
}

// Run main if executed directly
if (require.main === module) {
  main();
}

// Export functions for use as a module
module.exports = {
  convertMarkdownToPdf,
  convertMarkdownStringToPdf,
  getPageFormats,
  MarkdownToPdfmake
};
