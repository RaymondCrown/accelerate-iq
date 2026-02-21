import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Single-file extraction endpoint.
 * Called once per file from the client — keeps each request small (< 1MB).
 *
 * Bank statement PDF  → Haiku extracts monthly summary JSON
 * Management acct PDF → Haiku extracts full financial text
 * Excel / CSV         → xlsx extracts plain text (no AI needed)
 */
export async function POST(req: NextRequest) {
  try {
    const formData    = await req.formData();
    const file        = formData.get('file') as File;
    const businessName = formData.get('businessName') as string || 'Unknown Business';
    const inputType   = (formData.get('inputType') as string || 'bank') as 'bank' | 'management';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext    = file.name.toLowerCase().split('.').pop() || '';

    // ── Excel / CSV — no AI needed ────────────────────────────────────────
    if (['xlsx', 'xls', 'xlsm'].includes(ext)) {
      try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        let text = '';
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          text += `\n=== ${sheetName} ===\n` + XLSX.utils.sheet_to_csv(sheet);
        });
        return NextResponse.json({ type: 'text', filename: file.name, rawText: text.substring(0, 8000) });
      } catch (e) {
        return NextResponse.json({ type: 'text', filename: file.name, rawText: `[Excel error: ${e}]` });
      }
    }

    if (ext === 'csv') {
      return NextResponse.json({
        type: 'text', filename: file.name,
        rawText: buffer.toString('utf-8').substring(0, 8000),
      });
    }

    // ── PDF — send to Haiku as a document block ───────────────────────────
    if (ext !== 'pdf') {
      return NextResponse.json({ type: 'text', filename: file.name, rawText: buffer.toString('utf-8').substring(0, 4000) });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      // Return empty placeholder when no key — analyze route will use mock data
      return NextResponse.json({ type: 'monthly', filename: file.name, period: 'Demo', credits: 0, debits: 0, openingBal: 0, closingBal: 0, topIncome: [], topExpenses: [] });
    }

    const client = new Anthropic();

    if (inputType === 'bank') {
      // Bank statement: extract monthly summary as compact JSON
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
              title: file.name,
            } as Anthropic.Messages.DocumentBlockParam,
            {
              type: 'text',
              text: `Extract from this ${businessName} bank statement. Return ONLY raw JSON, no markdown:
{"period":"MMM YYYY","credits":0,"debits":0,"openingBal":0,"closingBal":0,"topIncome":["Name: R amount"],"topExpenses":["Name: R amount"]}
topIncome and topExpenses: up to 5 entries each. Use actual numbers.`,
            },
          ],
        }],
      });

      const raw   = message.content[0].type === 'text' ? message.content[0].text : '{}';
      const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      try {
        const parsed = JSON.parse(clean);
        return NextResponse.json({ type: 'monthly', filename: file.name, ...parsed });
      } catch {
        return NextResponse.json({ type: 'monthly', filename: file.name, period: file.name, credits: 0, debits: 0, openingBal: 0, closingBal: 0, topIncome: [], topExpenses: [], parseError: clean.substring(0, 200) });
      }

    } else {
      // Management accounts: extract full financial text
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
              title: file.name,
            } as Anthropic.Messages.DocumentBlockParam,
            {
              type: 'text',
              text: 'Extract all financial data from this document as plain text. Preserve all numbers, percentages, headings, and labels. Return only the extracted text, no commentary.',
            },
          ],
        }],
      });

      const text = message.content[0].type === 'text' ? message.content[0].text : '';
      return NextResponse.json({ type: 'text', filename: file.name, rawText: text });
    }

  } catch (error) {
    console.error('Extract error:', error);
    return NextResponse.json({ error: `Extraction failed: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }
}
