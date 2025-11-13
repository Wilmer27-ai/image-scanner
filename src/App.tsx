import { useState } from 'react'
import heic2any from 'heic2any'
import './App.css'
import { FileUpload } from './components/FileUpload'
import { ImagePreview } from './components/ImagePreview'
import { ExtractionResults } from './components/ExtractionResults'
import { ManualEntry } from './components/ManualEntry'
import { docextClient } from './lib/docextClient'
import type { ExtractedProduct } from './lib/docextClient'

// Compress image to target size using canvas
const compressImage = async (file: File, targetKB: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      // Start with 80% of original size
      const scaleFactor = 0.8;
      width = width * scaleFactor;
      height = height * scaleFactor;
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      
      // Try different quality levels to get under target size
      let quality = 0.7;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Compression failed'));
              return;
            }
            
            const sizeKB = blob.size / 1024;
            
            if (sizeKB <= targetKB || quality <= 0.1) {
              // Success or lowest quality reached
              const compressedFile = new File(
                [blob],
                file.name.replace(/\.(heic|heif)$/i, '.jpg'),
                { type: 'image/jpeg' }
              );
              resolve(compressedFile);
            } else {
              // Try lower quality
              quality -= 0.1;
              tryCompress();
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      tryCompress();
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [extractedProducts, setExtractedProducts] = useState<ExtractedProduct[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [extractionMeta, setExtractionMeta] = useState<{
    confidence?: number
    processingTime?: number
  }>({})

  const handleFileSelect = async (file: File) => {
    setExtractedProducts([])
    setShowManualEntry(false)
    setIsProcessing(true)
    
    try {
      let fileToProcess = file

      // Check if it's a HEIC file and convert to JPEG
      const isHeic = file.type === 'image/heic' || 
                     file.type === 'image/heif' || 
                     file.name.toLowerCase().endsWith('.heic') ||
                     file.name.toLowerCase().endsWith('.heif')

      if (isHeic) {
        console.log('Converting HEIC to JPEG...')
        try {
          const convertedBlob = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.9
          })

          const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob
          fileToProcess = new File(
            [blob],
            file.name.replace(/\.heic$/i, '.jpg'),
            { type: 'image/jpeg' }
          )
          
          console.log('✅ HEIC converted successfully:', {
            originalName: file.name,
            originalSize: `${(file.size / 1024).toFixed(2)} KB`,
            originalType: file.type,
            convertedName: fileToProcess.name,
            convertedSize: `${(fileToProcess.size / 1024).toFixed(2)} KB`,
            convertedType: fileToProcess.type
          });

          // Create object URL to verify the conversion
          const blobUrl = URL.createObjectURL(fileToProcess);
          console.log('🔍 Converted file blob URL:', blobUrl);
          console.log('🔍 You can open this URL in a new tab to verify the image converted correctly');

          // Use the converted file for both preview and OCR
          setSelectedFile(fileToProcess);
        } catch (conversionError) {
          console.error('❌ HEIC conversion failed:', conversionError)
          alert('Failed to convert HEIC image. Please try converting it to JPG first.')
          setIsProcessing(false)
          return
        }
      } else {
        console.log('Using original file:', file.name, 'Type:', file.type)
        setSelectedFile(file)
      }

      console.log('📤 Sending to OCR:', fileToProcess.name, 'Type:', fileToProcess.type, 'Size:', (fileToProcess.size / 1024).toFixed(2), 'KB')
      
      // Check if file is too large (OCR.space free tier has 1MB limit)
      const maxSizeKB = 1024; // 1MB
      let fileSizeKB = fileToProcess.size / 1024;
      
      if (fileSizeKB > maxSizeKB) {
        console.warn(`⚠️ File size (${fileSizeKB.toFixed(2)} KB) exceeds ${maxSizeKB} KB limit. Compressing...`);
        
        // Compress the image
        try {
          const compressed = await compressImage(fileToProcess, maxSizeKB);
          fileToProcess = compressed;
          fileSizeKB = compressed.size / 1024;
          console.log('✅ Compressed to:', fileSizeKB.toFixed(2), 'KB');
        } catch (err) {
          console.error('❌ Compression failed:', err);
          alert(`Warning: File size is ${fileSizeKB.toFixed(2)} KB. OCR.space free tier has a 1MB limit. The upload might fail.`);
        }
      }
      
      const result = await docextClient.extractProductData(fileToProcess)
      setExtractedProducts(result.products)
      setExtractionMeta({
        confidence: result.confidence,
        processingTime: result.processingTime
      })
    } catch (error) {
      console.error('Error extracting data:', error)
      alert('OCR processing failed. Please try again or use manual entry.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setExtractedProducts([])
    setExtractionMeta({})
    setShowManualEntry(false)
  }

  const handleManualEntry = () => {
    setShowManualEntry(true)
  }

  const handleManualProductsAdded = (products: ExtractedProduct[]) => {
    setExtractedProducts(products)
    setShowManualEntry(false)
    setExtractionMeta({ confidence: 1.0, processingTime: 0 })
  }

  const handleCancelManualEntry = () => {
    setShowManualEntry(false)
  }

  const handleCopyToClipboard = async () => {
    // Only copy the data rows, exclude the header
    const rows = extractedProducts.map(product => 
      `${product.productName || ''}\t${product.skuNumber || ''}\t${product.upc || ''}`
    )
    const tableText = rows.join('\n')
    
    try {
      await navigator.clipboard.writeText(tableText)
      // You could add a toast notification here
      console.log('Copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Document Scanner</h1>
      </header>

      <main className="app-main">
        <FileUpload 
          onFileSelect={handleFileSelect}
          selectedFile={selectedFile}
        />

        {selectedFile && (
          <ImagePreview 
            file={selectedFile}
            onRemove={handleRemoveFile}
          />
        )}

        {showManualEntry ? (
          <ManualEntry
            onProductsAdded={handleManualProductsAdded}
            onCancel={handleCancelManualEntry}
          />
        ) : (
          <>
            <ExtractionResults
              products={extractedProducts}
              isLoading={isProcessing}
              confidence={extractionMeta.confidence}
              processingTime={extractionMeta.processingTime}
              onCopyToClipboard={handleCopyToClipboard}
            />

            {!isProcessing && selectedFile && extractedProducts.length === 0 && (
              <div className="ocr-failed-message">
                <p>😕 OCR couldn't extract data from this image</p>
                <p>The image quality or angle might be affecting recognition</p>
                <button onClick={handleManualEntry} className="manual-entry-button">
                  ⌨️ Enter Data Manually
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
