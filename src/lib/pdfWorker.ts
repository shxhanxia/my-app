import * as pdfjs from 'pdfjs-dist';

// Use a stable CDN for the worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }

  return cleanText(fullText);
}

function cleanText(text: string): string {
  // Regex patterns for common section headers that we want to exclude
  const patterns = [
    /DISCUSSION[\s\S]*$/i,
    /REFERENCES[\s\S]*$/i,
    /ACKNOWLEDGEMENTS?[\s\S]*$/i,
    /Conflict of Interest[\s\S]*$/i,
    /Funding[\s\S]*$/i,
    /Supplementary Material[\s\S]*$/i,
    /参考文献[\s\S]*$/i,
    /讨论[\s\S]*$/i,
    /致谢[\s\S]*$/i,
  ];

  let cleaned = text;
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match && match.index !== undefined) {
      // Keep only what's before the first match of these sections
      cleaned = cleaned.substring(0, match.index);
    }
  }

  return cleaned.trim();
}
