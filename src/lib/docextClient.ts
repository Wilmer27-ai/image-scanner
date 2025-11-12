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
    console.log('Raw text:', text.substring(0, 500)); // First 500 chars for debugging

    // Extract ALL SKUs and UPCs from the entire text
    const skuPattern = /\b(122\d{10}|11\d{11})\b/g;  // SKU: 122... or 11... followed by digits
    const upcPattern = /\b([89]\d{12,13}|[45]\d{12,13})\b/g;  // UPC: starts with 8,9,4,5 + 12-13 digits

    // Find all SKUs and UPCs in order
    const allSkus: string[] = [];
    const allUpcs: string[] = [];
    const allProductNames: string[] = [];

    // Words to skip (headers, not product names)
    const skipWords = ['CHANGE', 'LOC ID', 'SKU NO', 'UPC', 'NAME', 'SHELF', 'DEPTH', 'NOF', 
                       'TIER', 'NOTCH', 'GONDOLA', 'GONDOL', 'CATEGORY', 'DEPARTMENT', 'EPARTMENT',
                       'VIEW BY', 'ELEMENT', 'STORE', 'STORE NA', 'HYPERMARKET', 'HYPERMA',
                       'LOCATION', 'BRAND', 'PAPER'];

    // Process each line
    for (const line of lines) {
      const upperLine = line.toUpperCase();
      
      // Skip if it's a header line or contains header keywords
      if (skipWords.some(word => upperLine.includes(word))) {
        continue;
      }

      // Skip shelf markers and depth markers
      if (upperLine.match(/^SHELF\/\d+/) || upperLine.match(/^DEPTH:\s*\d+/) || upperLine.match(/^NOTCH:\s*\d+/)) {
        continue;
      }
      
      // Skip lines that end with colons (labels like "Gondol:")
      if (line.trim().endsWith(':')) {
        continue;
      }
      
      // Skip very short lines (less than 3 characters)
      if (line.trim().length < 3) {
        continue;
      }

      // Extract SKU from this line
      const skuMatch = line.match(skuPattern);
      if (skuMatch) {
        allSkus.push(...skuMatch);
      }

      // Extract UPC from this line
      const upcMatch = line.match(upcPattern);
      if (upcMatch) {
        allUpcs.push(...upcMatch);
      }

      // Extract product name (any text that's not just numbers and is long enough)
      // Remove SKU and UPC numbers first
      let cleanLine = line
        .replace(/\b(122\d{10}|11\d{11})\b/g, '')  // Remove SKU
        .replace(/\b([89]\d{12,13}|[45]\d{12,13})\b/g, '')  // Remove UPC
        .replace(/\s+/g, ' ')  // Normalize spaces
        .trim();

      // If what's left looks like a product name (has letters and is long enough)
      if (cleanLine.length > 5 && /[A-Za-z]/.test(cleanLine) && !skipWords.includes(upperLine)) {
        // Remove any remaining standalone numbers at the start/end
        cleanLine = cleanLine.replace(/^\d+\s*/, '').replace(/\s*\d+$/, '').trim();
        
        if (cleanLine.length > 5) {
          allProductNames.push(cleanLine);
        }
      }
    }

    console.log(`Found ${allSkus.length} SKUs:`, allSkus);
    console.log(`Found ${allUpcs.length} UPCs:`, allUpcs);
    console.log(`Found ${allProductNames.length} product names:`, allProductNames);

    // Match them up in order (aligned as they appear in the document)
    const maxCount = Math.max(allSkus.length, allUpcs.length, allProductNames.length);
    
    for (let i = 0; i < maxCount; i++) {
      products.push({
        productName: allProductNames[i] || '',
        skuNumber: allSkus[i] || '',
        upc: allUpcs[i] || ''
      });
    }

    console.log(`Final extracted products:`, products.length);
    console.log('Sample products:', products.slice(0, 3));
    
    return products.slice(0, 100); // Allow up to 100 products
  }
}

// Default client instance
export const docextClient = new DocextClient();

export default DocextClient;
