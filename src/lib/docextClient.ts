// OCR Client using OCR.space API - Free and excellent for document extraction
export interface DocextConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface ExtractedProduct {
  productName: string;
  skuNumber: string;
  upc: string;
}

export interface DocextResponse {
  products: ExtractedProduct[];
  confidence: number;
  processingTime: number;
}

class DocextClient {
  private apiKey: string;

  constructor(config?: DocextConfig) {
    // Use free OCR.space API key (you can get your own at ocr.space)
    this.apiKey = config?.apiKey || 'K87899142388957'; // Free public API key
    console.log('OCR Client initialized with OCR.space API');
  }

  async extractProductData(file: File): Promise<DocextResponse> {
    console.log('Processing file with OCR.space API:', file.name);
    const startTime = Date.now();

    try {
      // Call OCR.space API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('apikey', this.apiKey);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');
      formData.append('detectOrientation', 'true');
      formData.append('scale', 'true');
      formData.append('OCREngine', '2'); // Use OCR Engine 2 (better for tables)

      console.log('Sending request to OCR.space API...');

      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      console.log('OCR API Full Response:', JSON.stringify(result, null, 2));

      if (result.IsErroredOnProcessing) {
        console.error('OCR Error Message:', result.ErrorMessage);
        console.error('OCR Error Details:', result.ErrorDetails);
        throw new Error(result.ErrorMessage || 'OCR processing failed');
      }

      if (!result.ParsedResults || result.ParsedResults.length === 0) {
        console.error('No parsed results returned from OCR');
        throw new Error('No text could be extracted from the image');
      }

      const extractedText = result.ParsedResults?.[0]?.ParsedText || '';
      console.log('Extracted text length:', extractedText.length);
      console.log('Extracted text:', extractedText);

      // Parse the extracted text
      const products = this.parseProductsFromText(extractedText);

      const processingTime = Date.now() - startTime;

      return {
        products,
        confidence: result.ParsedResults?.[0]?.TextOverlay?.HasOverlay ? 0.9 : 0.7,
        processingTime
      };

    } catch (error) {
      console.error('OCR processing failed:', error);

      return {
        products: [],
        confidence: 0,
        processingTime: Date.now() - startTime
      };
    }
  }

  private parseProductsFromText(text: string): ExtractedProduct[] {
    const products: ExtractedProduct[] = [];
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);

    console.log('Parsing lines:', lines.length);
    console.log('Raw text:', text.substring(0, 1000));

    // SKU and UPC patterns - expanded to include more formats
    const skuPattern = /\b(122\d{10}|11\d{11}|148\d{10}|146\d{10}|143\d{10}|145\d{10}|150\d{10})\b/;
    const upcPattern = /\b(0\d{12,13}|\d{13,14})\b/;

    const allProducts: Array<{name: string, sku: string, upc: string, lineIndex: number}> = [];

    // Headers and labels to skip
    const skipWords = [
      'CHANGE', 'LOC ID', 'SKU NO', 'UPC', 'NAME', 'SHELF', 'DEPTH', 'DEPH', 'NOF',
      'TIER', 'NOTCH', 'GONDOLA', 'GONDOL', 'CATEGORY', 'DEPARTMENT', 'EPARTMENT',
      'VIEW BY', 'ELEMENT', 'STORE', 'STORE NA', 'HYPERMARKET', 'HYPERMA', 'STO', 'HYP',
      'LOCATION', 'BRAND', 'PAPER', 'LOW BUD', 'BUD', 'PARTMENT', 'ARTMENT',
      'BREAKFAST', 'SEASONING', 'ADULT MILK'
    ];

    // First pass: analyze each line and categorize
    const productNameLines: Array<{text: string, index: number}> = [];
    const skuLines: Array<{sku: string, index: number}> = [];
    const upcLines: Array<{upc: string, index: number}> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const upperLine = line.toUpperCase();

      // Skip headers
      let isHeader = false;
      for (const word of skipWords) {
        if (upperLine === word || upperLine.startsWith(word + ':') || 
            upperLine.startsWith(word + ' ') || upperLine.endsWith(' ' + word) ||
            (upperLine.includes(':') && upperLine.includes(word))) {
          isHeader = true;
          break;
        }
      }
      if (isHeader) continue;

      // Skip specific patterns
      if (upperLine === 'CANNED' || upperLine === 'PET FOOD' || upperLine === 'FOOD' ||
          upperLine.startsWith('SHELF/') || upperLine.includes('... LOC ID') ||
          line.trim().endsWith(':') || line.length < 5 ||
          /^[A-Z]{2,6}:\s*[A-Z\s]+$/.test(upperLine)) {
        continue;
      }

      // Check what this line contains
      const hasSku = skuPattern.test(line);
      const skuMatch = line.match(skuPattern);
      const hasUpc = upcPattern.test(line);
      const upcMatches = line.match(new RegExp(upcPattern, 'g'));
      const hasText = /[A-Za-z]{5,}/.test(line);

      // Line with SKU and UPC together - extract all from same line
      if (hasSku && hasUpc && hasText) {
        const sku = skuMatch ? skuMatch[0] : '';
        const nonSkuUpcs = upcMatches ? upcMatches.filter(u => u !== sku) : [];
        const upc = nonSkuUpcs.length > 0 ? nonSkuUpcs[0] : '';
        
        let name = line;
        if (sku) name = name.replace(sku, '');
        if (upc) name = name.replace(upc, '');
        name = name.replace(/\s+/g, ' ').replace(/^\d+\s+/, '').trim();

        if (name.length > 5 && !name.includes('..') && !/^[a-z]{3,6}\d*$/.test(name.toLowerCase())) {
          products.push({ productName: name, skuNumber: sku, upc: upc });
        }
      }
      // Line is primarily a product name
      else if (hasText && !hasSku && !hasUpc) {
        let name = line.replace(/\s+/g, ' ').replace(/^\d+\s+/, '').trim();
        if (name.length > 5 && !name.includes('..') && 
            !name.toUpperCase().startsWith('DEPH') && !name.toUpperCase().startsWith('DEPTH') &&
            !/^[a-z]{3,6}\d*$/.test(name.toLowerCase())) {
          productNameLines.push({ text: name, index: i });
        }
      }
      // Line is primarily SKU
      else if (hasSku && !hasText) {
        if (skuMatch) {
          skuLines.push({ sku: skuMatch[0], index: i });
        }
      }
      // Line is primarily UPC
      else if (hasUpc && !hasText && !hasSku) {
        if (upcMatches) {
          upcMatches.forEach(upc => {
            upcLines.push({ upc: upc, index: i });
          });
        }
      }
    }

    // If we got data from same-line extraction, use that
    if (products.length > 0) {
      console.log(`Extracted ${products.length} products from same-line data`);
      return products.slice(0, 100);
    }

    // Otherwise, match by order (column-based OCR reading)
    console.log(`Found ${productNameLines.length} names, ${skuLines.length} SKUs, ${upcLines.length} UPCs in separate lines`);
    
    const maxCount = Math.max(productNameLines.length, skuLines.length, upcLines.length);
    for (let i = 0; i < maxCount; i++) {
      products.push({
        productName: productNameLines[i]?.text || '',
        skuNumber: skuLines[i]?.sku || '',
        upc: upcLines[i]?.upc || ''
      });
    }

    console.log(`Final extracted products: ${products.length}`);
    return products.slice(0, 100);
  }
}

// Default client instance
export const docextClient = new DocextClient();

export default DocextClient;
