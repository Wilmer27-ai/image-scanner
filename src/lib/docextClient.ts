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

    // SKU and UPC patterns
    const skuPattern = /^(14\d{9,11}|12\d{9,11}|11\d{9,11})$/;  // SKU: 11-13 digits starting with 14, 12, or 11
    const upcPattern = /^(\d{12,14})$/;

    // Headers to skip
    const skipWords = [
      'CHANGE', 'LOC ID', 'SKU NO', 'UPC', 'NAME', 'SHELF', 'DEPTH', 'DEPH', 'NOF',
      'TIER', 'NOTCH', 'GONDOLA', 'GONDOL', 'CATEGORY', 'DEPARTMENT', 'EPARTMENT',
      'VIEW BY', 'ELEMENT', 'STORE', 'STORE NA', 'HYPERMARKET', 'HYPERMA', 'STO', 'HYP',
      'LOCATION', 'BRAND', 'PAPER', 'LOW BUD', 'BUD', 'PARTMENT', 'ARTMENT',
      'BREAKFAST', 'SEASONING', 'ADULT MILK', 'TOILETRIES', 'HYGIENE', 
      'NEW ITEM', 'LISTING', 'SUMMARY', 'DISCONTINUE', 'CLEARANCE', 'PLAN',
      'BABY AND KIDS', 'MAX QTY', 'PIXEL', 'FIXEL', 'PRODUCT_ID', 'PRODUCT ID',
      'NOTCH_POSITION', 'NOTCH POSITION', 'BABY MILK POWDER', 'BABY MEAL', 'LOC_ID',
      'PIXEL_ID', 'FIXEL_ID'
    ];
    
    const skipPatterns = [
      /^FIXEL[_\s]?ID/i,
      /^PIXEL[_\s]?ID/i, 
      /^NOTCH[_\s]?POSITION/i,
      /^LOC[_\s]?ID/i,
      /^\d{1,3}$/,  // Short numbers only (row numbers like 13, 14, 15)
      /^\d+\.\d+$/,  // Decimal numbers (like 3.1, 3.2)
      /^[A-Z]{2,6}:\s*[A-Z\s]+$/
    ];

    // Collect data by type
    const upcs: string[] = [];
    const skus: string[] = [];
    const names: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const upperLine = line.toUpperCase();

      // Skip headers
      if (skipWords.some(word => 
        upperLine === word || 
        upperLine.includes(word + ':') || 
        upperLine.startsWith(word + ' ') ||
        upperLine.endsWith(' ' + word)
      )) {
        continue;
      }

      // Skip patterns
      if (skipPatterns.some(pattern => pattern.test(line))) {
        continue;
      }

      // Check if this is a standalone UPC
      if (upcPattern.test(line)) {
        const num = line.match(upcPattern)?.[0];
        if (num && !skuPattern.test(num)) {
          upcs.push(num);
          console.log(`UPC found: ${num}`);
          continue;
        }
      }

      // Check if this is a standalone SKU
      if (skuPattern.test(line)) {
        const num = line.match(skuPattern)?.[0];
        if (num) {
          skus.push(num);
          console.log(`SKU found: ${num}`);
          continue;
        }
      }

      // Check if this line has all three (row format)
      const allNumbers = line.match(/\b\d{11,14}\b/g) || [];
      const skuMatch = line.match(/\b(14\d{9,11}|12\d{9,11}|11\d{9,11})\b/);
      
      if (allNumbers.length >= 2 && skuMatch) {
        // This line has UPC, SKU, and likely name
        const sku = skuMatch[0];
        const upc = allNumbers.find(n => n !== sku) || '';
        let name = line.replace(sku, '').replace(upc, '');
        name = name.replace(/\s+/g, ' ').replace(/^\d+\s+/, '').replace(/[•·]/, '').trim();
        
        if (name.length > 3 && /[A-Za-z]{3,}/.test(name)) {
          products.push({ productName: name, skuNumber: sku, upc: upc });
          console.log(`Row format found: UPC="${upc}", SKU="${sku}", Name="${name}"`);
          continue;
        }
      }

      // Otherwise, check if it's a product name
      if (line.length > 5 && /[A-Za-z]{5,}/.test(line) && 
          !/^[a-z]{2,6}\d*$/i.test(line) && !line.includes('..')) {
        names.push(line);
        console.log(`Name found: ${line}`);
      }
    }

    console.log(`Column-based extraction: ${upcs.length} UPCs, ${skus.length} SKUs, ${names.length} Names`);
    console.log(`Row-based extraction: ${products.length} products`);

    // If we got row-based data, return it
    if (products.length > 0) {
      console.log(`Using row-based data: ${products.length} products`);
      return products.slice(0, 100);
    }

    // Otherwise, match columns by index
    const maxCount = Math.max(upcs.length, skus.length, names.length);
    console.log(`Matching ${maxCount} products by column position`);

    for (let i = 0; i < maxCount; i++) {
      products.push({
        productName: names[i] || '',
        skuNumber: skus[i] || '',
        upc: upcs[i] || ''
      });
    }

    console.log(`Final extracted products: ${products.length}`);
    return products.slice(0, 100);
  }
}

// Default client instance
export const docextClient = new DocextClient();

export default DocextClient;
