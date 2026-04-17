import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { addInventory as addInventoryApi } from '../../services/api';
import { Spinner } from '../common/Loading';
import toast from 'react-hot-toast';

const CATEGORY_MAPPINGS: { [key: string]: { category: string; skuPrefix: string } } = {
  bolt: { category: 'Fasteners', skuPrefix: 'BLT' },
  screw: { category: 'Fasteners', skuPrefix: 'SCW' },
  rivet: { category: 'Fasteners', skuPrefix: 'RVT' },
  nail: { category: 'Fasteners', skuPrefix: 'NIL' },
  nut: { category: 'Fasteners', skuPrefix: 'NUT' },
  washer: { category: 'Fasteners', skuPrefix: 'WSH' },
  bracket: { category: 'Hardware', skuPrefix: 'BRK' },
  hinge: { category: 'Hardware', skuPrefix: 'HNG' },
  clamp: { category: 'Hardware', skuPrefix: 'CLP' },
  hook: { category: 'Hardware', skuPrefix: 'HOK' },
  hammer: { category: 'Tools', skuPrefix: 'HMR' },
  wrench: { category: 'Tools', skuPrefix: 'WRN' },
  screwdriver: { category: 'Tools', skuPrefix: 'SDV' },
  pliers: { category: 'Tools', skuPrefix: 'PLY' },
  drill: { category: 'Power Tools', skuPrefix: 'DRL' },
  saw: { category: 'Tools', skuPrefix: 'SAW' },
  wire: { category: 'Electrical', skuPrefix: 'WIR' },
  cable: { category: 'Electrical', skuPrefix: 'CBL' },
  plug: { category: 'Electrical', skuPrefix: 'PLG' },
  switch: { category: 'Electrical', skuPrefix: 'SWT' },
  socket: { category: 'Electrical', skuPrefix: 'SCK' },
  pipe: { category: 'Plumbing', skuPrefix: 'PIP' },
  tube: { category: 'Plumbing', skuPrefix: 'TBE' },
  hose: { category: 'Plumbing', skuPrefix: 'HSE' },
  valve: { category: 'Plumbing', skuPrefix: 'VLV' },
  faucet: { category: 'Plumbing', skuPrefix: 'FCT' },
  helmet: { category: 'Safety Equipment', skuPrefix: 'HLM' },
  glove: { category: 'Safety Equipment', skuPrefix: 'GLV' },
  goggles: { category: 'Safety Equipment', skuPrefix: 'GOG' },
  umbrella: { category: 'Weather Protection', skuPrefix: 'UMB' },
};

function getCategoryAndSku(term: string): { category: string; skuPrefix: string } {
  const termLower = term.toLowerCase();
  for (const [key, value] of Object.entries(CATEGORY_MAPPINGS)) {
    if (termLower.includes(key) || key.includes(termLower)) {
      return value;
    }
  }
  return { category: 'General', skuPrefix: 'GEN' };
}

interface FormErrors {
  name?: string;
  sku?: string;
  quantity?: string;
  unitPrice?: string;
  location?: string;
}

const AddInventoryForm: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minStock, setMinStock] = useState('10');
  const [unitPrice, setUnitPrice] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedLabels, setDetectedLabels] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  
  const modelRef = useRef<any>(null);
  
  useEffect(() => {
    const loadModel = async () => {
      try {
        const tf = await import('@tensorflow/tfjs');
        const mobilenet = await import('@tensorflow-models/mobilenet');
        await tf.ready();
        modelRef.current = await mobilenet.load({ version: 2, alpha: 1.0 });
      } catch (err) {
        console.log('AI model not available');
      }
    };
    loadModel();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!name.trim()) {
      newErrors.name = 'Product name is required';
    } else if (name.length < 2) {
      newErrors.name = 'Product name must be at least 2 characters';
    }
    
    if (!sku.trim()) {
      newErrors.sku = 'SKU is required';
    } else if (sku.length < 3) {
      newErrors.sku = 'SKU must be at least 3 characters';
    }
    
    const qty = parseInt(quantity);
    if (!quantity) {
      newErrors.quantity = 'Quantity is required';
    } else if (isNaN(qty) || qty < 0) {
      newErrors.quantity = 'Quantity must be a positive number';
    }
    
    if (unitPrice && (isNaN(parseFloat(unitPrice)) || parseFloat(unitPrice) < 0)) {
      newErrors.unitPrice = 'Unit price must be a positive number';
    }
    
    if (location && !/^[A-Z]-\d+-\d+$/i.test(location)) {
      newErrors.location = 'Location format should be: A-1-3 (Isle-Row-Shelf)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const analyzeImage = async (file: File) => {
    if (!modelRef.current) return;
    
    setIsAnalyzing(true);
    try {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
      });
      
      const predictions = await modelRef.current.classify(img, 5);
      const labels = predictions
        .filter((p: any) => p.probability > 0.01)
        .map((p: any) => p.className.toLowerCase());
      
      const allTerms: string[] = [];
      labels.forEach((label: string) => {
        label.split(/[\s\-_]+/).forEach((word: string) => {
          if (word.length > 2) allTerms.push(word);
        });
        allTerms.push(label.split(',')[0].trim());
      });
      
      const uniqueLabels = [...new Set(allTerms)];
      setDetectedLabels(uniqueLabels);
      
      if (uniqueLabels.length > 0) {
        const { category: suggestedCategory, skuPrefix } = getCategoryAndSku(uniqueLabels[0]);
        if (!category) setCategory(suggestedCategory);
        if (!sku) {
          const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
          setSku(`${skuPrefix}-${randomNum}`);
        }
      }
    } catch (err) {
      console.error('Image analysis error:', err);
    }
    setIsAnalyzing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      let finalImageUrl = imageUrl;
      
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          finalImageUrl = uploadData.url;
        }
      }
      
      await addInventoryApi({
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        quantity: parseInt(quantity),
        min_stock_level: parseInt(minStock) || 10,
        unit_price: unitPrice ? parseFloat(unitPrice) : 0,
        category: category.trim() || 'General',
        location: location.trim().toUpperCase(),
        image_url: finalImageUrl,
        description: description.trim(),
      });
      
      toast.success(`${name} added to inventory!`);
      queryClient.invalidateQueries(['inventory']);
      
      setTimeout(() => {
        navigate('/inventory');
      }, 1500);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to add item. Please try again.';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (hasError: boolean) => `
    w-full px-4 py-2.5 border rounded-lg transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
    ${hasError 
      ? 'border-red-300 bg-red-50 focus:ring-red-500' 
      : 'border-gray-300 hover:border-gray-400'
    }
  `;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Add Inventory Item</h1>
        <p className="text-gray-500 mt-1">Fill in the details below to add a new item to your inventory</p>
      </div>
      
      {successMessage ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-xl font-semibold text-green-700">{successMessage}</p>
          <p className="text-green-600 mt-2">Redirecting to inventory...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass(!!errors.name)}
                placeholder="e.g., Hex Bolt M8"
              />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SKU <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                className={inputClass(!!errors.sku)}
                placeholder="BLT-HX-001"
              />
              {errors.sku && <p className="mt-1 text-sm text-red-500">{errors.sku}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass(false)}
                placeholder="Fasteners"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputClass(!!errors.quantity)}
                placeholder="0"
                min="0"
              />
              {errors.quantity && <p className="mt-1 text-sm text-red-500">{errors.quantity}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Unit Price ($)</label>
              <input
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className={inputClass(!!errors.unitPrice)}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
              {errors.unitPrice && <p className="mt-1 text-sm text-red-500">{errors.unitPrice}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Min Stock Level</label>
              <input
                type="number"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className={inputClass(false)}
                placeholder="10"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Warehouse Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value.toUpperCase())}
                className={inputClass(!!errors.location)}
                placeholder="A-1-3"
              />
              {errors.location && <p className="mt-1 text-sm text-red-500">{errors.location}</p>}
              <p className="mt-1 text-xs text-gray-400">Format: Isle-Row-Shelf (e.g., A-1-3)</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Product Image</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImageFile(file);
                      setImageUrl(`/uploads/images/${file.name}`);
                      analyzeImage(file);
                    }
                  }}
                  className="hidden"
                  id="image-upload"
                />
                <label htmlFor="image-upload" className="cursor-pointer">
                  <svg className="w-10 h-10 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-gray-500">Click to upload or drag and drop</span>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 10MB</p>
                </label>
              </div>
              {imageFile && (
                <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {imageFile.name}
                </p>
              )}
              {isAnalyzing && (
                <div className="mt-2 flex items-center gap-2 text-purple-600">
                  <Spinner size="sm" />
                  <span className="text-sm">AI analyzing image...</span>
                </div>
              )}
            </div>

            {detectedLabels.length > 0 && (
              <div className="md:col-span-2 bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-xl border border-purple-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🤖</span>
                  <span className="font-semibold text-purple-800">AI Suggestions</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {detectedLabels.slice(0, 5).map((label, i) => (
                    <span key={i} className="bg-white text-purple-700 px-3 py-1 rounded-full text-sm border border-purple-200">
                      {label}
                    </span>
                  ))}
                </div>
                {sku && (
                  <div className="text-sm text-purple-700 bg-white/50 p-2 rounded-lg">
                    <span className="font-medium">Suggested:</span> SKU: <strong>{sku}</strong> | Category: <strong>{category}</strong>
                  </div>
                )}
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass(false)}
                placeholder="Product description..."
                rows={3}
              />
            </div>
          </div>

          <div className="mt-8 flex gap-4 justify-end">
            <Link
              to="/inventory"
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSubmitting && <Spinner size="sm" />}
              {isSubmitting ? 'Adding...' : 'Add Item'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AddInventoryForm;
