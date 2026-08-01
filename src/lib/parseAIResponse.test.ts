import { describe, it, expect } from 'vitest';
import { parseAIResponse } from './parseAIResponse';

describe('parseAIResponse', () => {
    it('parses a plain JSON array', () => {
        const out = parseAIResponse('[{"pdfName":"a.pdf","age":35}]');
        expect(out).toHaveLength(1);
        expect(out[0].pdfName).toBe('a.pdf');
        expect(out[0].age).toBe(35);
    });

    it('strips markdown code fences', () => {
        const out = parseAIResponse(
            '```json\n[{"pdfName":"b.pdf"}]\n```',
        );
        expect(out[0].pdfName).toBe('b.pdf');
    });

    it('extracts the array from text with a preamble and trailing prose', () => {
        const out = parseAIResponse(
            'Here is the extracted data:\n[{"pdfName":"c.pdf"}]\nThat is all.',
        );
        expect(out[0].pdfName).toBe('c.pdf');
    });

    it('handles a {"results": [...]} wrapper object', () => {
        const out = parseAIResponse(
            '{"results":[{"pdfName":"d.pdf"}]}',
        );
        expect(out).toHaveLength(1);
        expect(out[0].pdfName).toBe('d.pdf');
    });

    it('handles a {"data": [...]} wrapper object', () => {
        const out = parseAIResponse('{"data":[{"pdfName":"d2.pdf"}]}');
        expect(out[0].pdfName).toBe('d2.pdf');
    });

    it('wraps a single object into an array', () => {
        const out = parseAIResponse('{"pdfName":"e.pdf"}');
        expect(out).toHaveLength(1);
        expect(out[0].pdfName).toBe('e.pdf');
    });

    it('preserves multiple cases within one array', () => {
        const out = parseAIResponse(
            '[{"pdfName":"f.pdf","gender":"Male"},{"pdfName":"f.pdf","gender":"Female"}]',
        );
        expect(out).toHaveLength(2);
        expect(out[1].gender).toBe('Female');
    });

    it('throws on invalid JSON', () => {
        expect(() => parseAIResponse('not json at all')).toThrow();
    });
});
