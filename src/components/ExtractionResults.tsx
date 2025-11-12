import React from 'react';
import type { ExtractedProduct } from '../lib/docextClient';
import './ExtractionResults.css';

interface ExtractionResultsProps {
  products: ExtractedProduct[];
  isLoading: boolean;
  confidence?: number;
  processingTime?: number;
  onCopyToClipboard: () => void;
}

export const ExtractionResults: React.FC<ExtractionResultsProps> = ({
  products,
  isLoading,
  confidence,
  processingTime,
  onCopyToClipboard
}) => {
  const formatTableText = () => {
    const header = "Product Name | SKU Number | UPC";
    const separator = "---|---|---";
    const rows = products.map(product => 
      `${product.productName || ''} | ${product.skuNumber || ''} | ${product.upc || ''}`
    );
    return [header, separator, ...rows].join('\n');
  };

  const copyRowToClipboard = async (product: ExtractedProduct) => {
    const rowText = `${product.productName || ''}\t${product.skuNumber || ''}\t${product.upc || ''}`;
    try {
      await navigator.clipboard.writeText(rowText);
      // Optional: Show a brief success indicator
    } catch (err) {
      console.error('Failed to copy row:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="extraction-results loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Processing document with Tesseract.js OCR...</p>
          <p className="loading-hint">Reading text and extracting product data from your catalog</p>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <div className="extraction-results">
      <div className="results-header">
        <h3>Extracted Product Data</h3>
        <div className="results-meta">
          {confidence && (
            <span className="confidence">
              Confidence: {(confidence * 100).toFixed(1)}%
            </span>
          )}
          {processingTime && (
            <span className="processing-time">
              Processed in {(processingTime / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>

      <div className="results-actions">
        <button 
          onClick={onCopyToClipboard}
          className="copy-button"
          title="Copy table data to clipboard"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy for Excel
        </button>
      </div>

      <div className="table-container">
        <table className="results-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>SKU Number</th>
              <th>UPC</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => (
              <tr key={index}>
                <td className="product-name">{product.productName || '-'}</td>
                <td className="sku-number">{product.skuNumber || '-'}</td>
                <td className="upc">{product.upc || '-'}</td>
                <td className="actions">
                  <button 
                    onClick={() => copyRowToClipboard(product)}
                    className="copy-row-button"
                    title="Copy this row"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="copy-preview">
        <h4>Preview (ready for Excel):</h4>
        <pre className="table-text">{formatTableText()}</pre>
      </div>
    </div>
  );
};