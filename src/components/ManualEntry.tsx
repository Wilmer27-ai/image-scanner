import React, { useState } from 'react';
import type { ExtractedProduct } from '../lib/docextClient';
import './ManualEntry.css';

interface ManualEntryProps {
  onProductsAdded: (products: ExtractedProduct[]) => void;
  onCancel: () => void;
}

export const ManualEntry: React.FC<ManualEntryProps> = ({ onProductsAdded, onCancel }) => {
  const [formData, setFormData] = useState({
    productName: '',
    skuNumber: '',
    upc: ''
  });
  const [products, setProducts] = useState<ExtractedProduct[]>([]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAddProduct = () => {
    if (formData.productName || formData.skuNumber || formData.upc) {
      setProducts([...products, { ...formData }]);
      setFormData({ productName: '', skuNumber: '', upc: '' });
    }
  };

  const handleRemoveProduct = (index: number) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (products.length > 0) {
      onProductsAdded(products);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddProduct();
    }
  };

  return (
    <div className="manual-entry-container">
      <div className="manual-entry-header">
        <h3>⌨️ Manual Entry Mode</h3>
        <p>Add products manually when OCR doesn't work well</p>
      </div>

      <div className="manual-entry-form">
        <div className="form-row">
          <input
            type="text"
            name="productName"
            placeholder="Product Name"
            value={formData.productName}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            className="form-input"
          />
          <input
            type="text"
            name="skuNumber"
            placeholder="SKU Number"
            value={formData.skuNumber}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            className="form-input"
          />
          <input
            type="text"
            name="upc"
            placeholder="UPC"
            value={formData.upc}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            className="form-input"
          />
          <button onClick={handleAddProduct} className="add-button">
            + Add
          </button>
        </div>
      </div>

      {products.length > 0 && (
        <div className="products-list">
          <h4>Added Products ({products.length})</h4>
          <div className="products-table">
            {products.map((product, index) => (
              <div key={index} className="product-row">
                <span className="product-name">{product.productName || '-'}</span>
                <span className="product-sku">{product.skuNumber || '-'}</span>
                <span className="product-upc">{product.upc || '-'}</span>
                <button
                  onClick={() => handleRemoveProduct(index)}
                  className="remove-button"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="manual-entry-actions">
        <button onClick={onCancel} className="cancel-button">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="submit-button"
          disabled={products.length === 0}
        >
          Use These Products ({products.length})
        </button>
      </div>
    </div>
  );
};