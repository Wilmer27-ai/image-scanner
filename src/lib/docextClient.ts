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
    const skuPattern = /\b(122\d{10}|11\d{11}|148\d{10}|146\d{10})\b/g;
    const upcPattern = /\b([89]\d{12,13}|[45]\d{12,13})\b/g;

    const allSkus: string[] = [];
    const allUpcs: string[] = [];
    const allProductNames: string[] = [];

    // Headers and labels to skip
    const skipWords = [
      'CHANGE', 'LOC ID', 'SKU NO', 'UPC', 'NAME', 'SHELF', 'DEPTH', 'DEPH', 'NOF',
      'TIER', 'NOTCH', 'GONDOLA', 'GONDOL', 'CATEGORY', 'DEPARTMENT', 'EPARTMENT',
      'VIEW BY', 'ELEMENT', 'STORE', 'STORE NA', 'HYPERMARKET', 'HYPERMA', 'STO', 'HYP',
      'LOCATION', 'BRAND', 'PAPER', 'LOW BUD', 'BUD', 'PARTMENT'
    ];

    // Process each line
    for (const line of lines) {
      const upperLine = line.toUpperCase();

      // Skip headers and labels
      if (skipWords.some(word => upperLine.includes(word))) {
        continue;
      }

      // Skip lines ending with colon
      if (line.trim().endsWith(':')) {
        continue;
      }

      // Skip very short lines
      if (line.length < 5) {
        continue;
      }

      // Extract SKUs from this line
      const skuMatches = line.match(skuPattern);
      if (skuMatches) {
        allSkus.push(...skuMatches);
      }

      // Extract UPCs from this line
      const upcMatches = line.match(upcPattern);
      if (upcMatches) {
        allUpcs.push(...upcMatches);
      }

      // Extract product names (lines with letters but no SKU/UPC)
      if (!skuMatches && !upcMatches && /[A-Za-z]{3,}/.test(line)) {
        let cleanName = line
          .replace(/\s+/g, ' ')
          .replace(/^\d+\s+/, '')
          .trim();

        // Skip if it starts with depth marker
        if (cleanName.toUpperCase().startsWith('DEPH') ||
          cleanName.toUpperCase().startsWith('DEPTH') ||
          cleanName.toUpperCase().startsWith('DER')) {
          continue;
        }

        if (cleanName.length > 5) {
          allProductNames.push(cleanName);
        }
      }
    }

    console.log(`Found ${allSkus.length} SKUs:`, allSkus);
    console.log(`Found ${allUpcs.length} UPCs:`, allUpcs);
    console.log(`Found ${allProductNames.length} product names:`, allProductNames);

    // Match them up in order
    const maxCount = Math.max(allSkus.length, allUpcs.length, allProductNames.length);

    for (let i = 0; i < maxCount; i++) {
      products.push({
        productName: allProductNames[i] || '',
        skuNumber: allSkus[i] || '',
        upc: allUpcs[i] || ''
      });
    }

    console.log(`Final extracted products: ${products.length}`);

    return products.slice(0, 100);
  }
}

// Default client instance
export const docextClient = new DocextClient();

export default DocextClient;
