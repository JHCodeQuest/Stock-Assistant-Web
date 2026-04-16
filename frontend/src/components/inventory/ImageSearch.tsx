import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getInventory } from '../../services/api';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';

const WAREHOUSE_TERMS: { [key: string]: string[] } = {
  hardware: ['bolt', 'screw', 'nail', 'rivet', 'washer', 'nut', 'bracket', 'hinge', 'handle', 'lock', ' latch', 'hook', 'clamp'],
  tools: ['hammer', 'wrench', 'screwdriver', 'pliers', 'drill', 'saw', 'axe', 'file', 'chisel', 'level', 'tape', 'measure'],
  electrical: ['wire', 'cable', 'plug', 'socket', 'switch', 'outlet', 'breaker', 'fuse', 'bulb', 'lamp', 'battery'],
  plumbing: ['pipe', 'tube', 'hose', 'valve', 'faucet', 'tap', 'joint', 'elbow', 'tee', 'connector', 'adapter'],
  building: ['brick', 'block', 'cement', 'mortar', 'tile', 'board', 'plywood', 'beam', 'post', 'panel'],
  safety: ['helmet', 'glove', 'goggles', 'vest', 'boots', 'mask', 'guard', 'sign'],
  fasteners: ['bolt', 'screw', 'rivet', 'pin', 'clip', 'staple', 'nail'],
  automotive: ['filter', 'belt', 'hose', 'gasket', 'seal', 'bearing', 'bush', 'bolt', 'nut'],
  umbrella: ['umbrella', 'parasol', 'sunshade', 'canopy', 'brolly'],
  garden: ['shovel', 'rake', 'hoe', 'spade', 'fork', 'trowel', 'pruner', 'shears'],
  office: ['paper', 'pen', 'pencil', 'stapler', 'clip', 'folder', 'binder', 'tape'],
};

const SYNONYMS: { [key: string]: string[] } = {
  bolt: ['screw', 'fastener', 'stud', 'rod', 'pole', 'pin', 'rivet', 'tension'],
  screw: ['bolt', 'fastener', 'rivet', 'nail', 'self-tap'],
  pole: ['rod', 'stick', 'post', 'bar', 'shaft', 'staff', 'baton'],
  rod: ['pole', 'stick', 'bar', 'shaft', 'pole', 'reinforcement'],
  pipe: ['tube', 'cylinder', 'hose', 'conduit', 'pipeline'],
  tube: ['pipe', 'cylinder', 'hose', 'barrel'],
  clamp: ['clip', 'holder', 'bracket', 'grip', 'vice', 'cramp'],
  umbrella: ['parasol', 'sunshade', 'canopy', 'brolly', 'rain'],
  metal: ['steel', 'iron', 'aluminum', 'brass', 'copper', 'alloy', 'chrome'],
  steel: ['metal', 'iron', 'stainless', 'carbon'],
  blue: ['azure', 'cobalt', 'navy', 'sky', 'cerulean'],
  red: ['crimson', 'scarlet', 'ruby', 'maroon', 'vermillion'],
  green: ['emerald', 'lime', 'olive', 'forest'],
  yellow: ['gold', 'amber', 'lemon', 'mustard'],
  black: ['charcoal', 'ebony', 'onyx', 'jet'],
  white: ['ivory', 'pearl', 'snow', 'cream'],
  widget: ['gadget', 'component', 'part', 'device', 'unit', 'assembly'],
  standard: ['regular', 'normal', 'basic', 'typical', 'conventional'],
  large: ['big', 'large', 'oversized', 'jumbo', 'giant'],
  small: ['little', 'mini', 'miniature', 'compact', 'tiny'],
  product: ['item', 'goods', 'merchandise', 'article', 'object'],
  electronic: ['electrical', 'digital', 'tech', 'circuit'],
  heavy: ['weighty', 'massive', 'substantial', 'dense'],
  light: ['lightweight', 'portable', 'airy', 'feather'],
  tool: ['implement', 'device', 'instrument', 'appliance'],
  part: ['component', 'piece', 'element', 'segment'],
  industrial: ['commercial', 'professional', 'heavy-duty', 'factory'],
};

function expandSearchTerms(terms: string[]): string[] {
  const expanded = new Set<string>();
  
  for (const term of terms) {
    expanded.add(term.toLowerCase());
    
    for (const [key, values] of Object.entries(SYNONYMS)) {
      if (key.includes(term) || term.includes(key)) {
        expanded.add(key);
        values.forEach(v => expanded.add(v));
      }
      if (values.includes(term.toLowerCase())) {
        expanded.add(key);
        values.forEach(v => expanded.add(v));
      }
    }
    
    for (const [category, keywords] of Object.entries(WAREHOUSE_TERMS)) {
      if (keywords.some(k => k.includes(term) || term.includes(k))) {
        keywords.forEach(k => expanded.add(k));
      }
    }
  }
  
  return Array.from(expanded);
}

function scoreItem(item: any, searchTerms: string[]): number {
  const itemText = `${item.name} ${item.sku} ${item.description || ''} ${item.category || ''}`.toLowerCase();
  let score = 0;
  const matchedTerms: string[] = [];
  
  const expandedTerms = expandSearchTerms(searchTerms);
  
  for (const term of expandedTerms) {
    if (item.name.toLowerCase().includes(term)) {
      score += 5;
      matchedTerms.push(term);
    } else if (item.sku.toLowerCase().includes(term)) {
      score += 3;
      matchedTerms.push(term);
    } else if (itemText.includes(term)) {
      score += 1;
      matchedTerms.push(term);
    }
  }
  
  const itemWords = item.name.toLowerCase().split(/[\s\-_]+/);
  for (const word of itemWords) {
    if (word.length > 3 && expandedTerms.some(t => t.includes(word) || word.includes(t))) {
      score += 2;
    }
  }
  
  return score;
}

const ImageSearch: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [matchedItems, setMatchedItems] = useState<any[]>([]);
  const [matchMessage, setMatchMessage] = useState('');
  const [detectedLabels, setDetectedLabels] = useState<string[]>([]);
  const [uploadedFilename, setUploadedFilename] = useState('');
  const modelRef = useRef<mobilenet.MobileNet | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const response = await getInventory();
      return response.data;
    },
  });

  useEffect(() => {
    const loadModel = async () => {
      try {
        setIsModelLoading(true);
        await tf.ready();
        modelRef.current = await mobilenet.load({ version: 2, alpha: 1.0 });
        setModelReady(true);
        console.log('AI model loaded successfully');
      } catch (error) {
        console.error('Failed to load AI model:', error);
        setModelReady(false);
      }
      setIsModelLoading(false);
    };
    loadModel();
  }, []);

  const classifyImage = async (imgElement: HTMLImageElement): Promise<string[]> => {
    if (!modelRef.current) return [];
    
    try {
      const predictions = await modelRef.current.classify(imgElement, 5);
      const labels = predictions
        .filter(p => p.probability > 0.01)
        .map(p => p.className.toLowerCase())
        .map(label => label.split(',')[0].trim());
      
      const searchTerms: string[] = [];
      labels.forEach(label => {
        label.split(/[\s\-_]+/).forEach(word => {
          if (word.length > 2) searchTerms.push(word);
        });
      });
      
      return [...new Set([...labels, ...searchTerms])];
    } catch (error) {
      console.error('Classification error:', error);
      return [];
    }
  };

  const analyzeImage = async (imageData: string, filename: string) => {
    setIsAnalyzing(true);
    setMatchedItems([]);
    setMatchMessage('');
    setDetectedLabels([]);
    
    try {
      let searchTerms: string[] = [];
      
      if (modelReady && imageData) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageData;
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
        });
        
        const labels = await classifyImage(img);
        setDetectedLabels(labels);
        searchTerms = labels;
      }
      
      const filenameTerms = filename
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .split(/[\s\-_]+/)
        .filter(t => t.length > 2);
      
      searchTerms = [...new Set([...searchTerms, ...filenameTerms])];
      
      if (searchTerms.length === 0) {
        setMatchMessage('Could not identify image content. Try a clearer photo.');
        setMatchedItems([]);
        setIsAnalyzing(false);
        return;
      }
      
      const expandedTerms = expandSearchTerms(searchTerms);
      
      const scoredItems = (inventory || [])
        .filter((item: any) => item.image_url)
        .map((item: any) => ({
          ...item,
          matchScore: scoreItem(item, searchTerms),
        }))
        .filter((item: any) => item.matchScore > 0)
        .sort((a: any, b: any) => b.matchScore - a.matchScore);
      
      setMatchedItems(scoredItems.slice(0, 10));
      
      if (scoredItems.length > 0) {
        setMatchMessage(`Found ${scoredItems.length} item(s) matching your image`);
      } else {
        setMatchMessage('No exact matches found. Show this to Main Stores for help.');
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
      setMatchMessage('Error analyzing image. Try again.');
    }
    
    setIsAnalyzing(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFilename(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
        analyzeImage(reader.result as string, file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectItem = (item: any) => {
    setSelectedImage(item.image_url);
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">AI Image Search</h1>
      
      {isModelLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-700">🤖 Loading AI model...</p>
        </div>
      )}
      
      {modelReady && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-700">✅ AI model ready - Smart matching enabled</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">1. Upload Your Photo</h2>
          <p className="text-gray-600 mb-4">
            Take a photo of what you're looking for. Our AI will identify it and find matching items.
          </p>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="image-upload"
            />
            <label htmlFor="image-upload" className="cursor-pointer">
              {uploadedImage ? (
                <div>
                  <img 
                    src={uploadedImage} 
                    alt="Uploaded" 
                    className="max-h-64 mx-auto rounded-lg"
                  />
                  <p className="text-sm text-gray-500 mt-2">{uploadedFilename}</p>
                </div>
              ) : (
                <div className="py-8">
                  <div className="text-6xl mb-4">📷</div>
                  <p className="text-gray-600">Click or drag to upload an image</p>
                  <p className="text-sm text-gray-400 mt-2">PNG, JPG, GIF up to 10MB</p>
                </div>
              )}
            </label>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">2. AI Analysis</h2>
          
          {isAnalyzing ? (
            <div className="text-center py-8">
              <div className="animate-spin text-4xl mb-4">🤖</div>
              <p className="text-gray-600">AI is analyzing your image...</p>
            </div>
          ) : detectedLabels.length > 0 && (
            <div className="mb-4 p-4 bg-purple-50 rounded-lg">
              <p className="font-semibold text-purple-800 mb-2">🔍 AI Detected:</p>
              <div className="flex flex-wrap gap-2">
                {detectedLabels.slice(0, 5).map((label, i) => (
                  <span key={i} className="bg-purple-200 text-purple-800 px-3 py-1 rounded-full text-sm">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {matchedItems.length > 0 ? (
            <div className="space-y-4">
              {matchMessage && (
                <p className="text-green-600 font-medium">{matchMessage}</p>
              )}
              <p className="text-sm text-gray-500">
                Click on an item to select it as a reference
              </p>
              
              <div className="space-y-3 mt-4">
                {matchedItems.map((item, index) => (
                  <div 
                    key={item.id} 
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      item.matchScore >= 5 ? 'border-green-500 bg-green-50' : 
                      item.matchScore >= 3 ? 'border-yellow-500 bg-yellow-50' :
                      'border-gray-300 hover:shadow-md'
                    }`}
                    onClick={() => handleSelectItem(item)}
                  >
                    <div className="flex gap-4">
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-20 h-20 object-cover rounded"
                          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                            {item.category && (
                              <p className="text-xs text-gray-400">Category: {item.category}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              item.quantity === 0 ? 'bg-red-100 text-red-800' :
                              item.quantity <= (item.min_stock_level || 10) ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {item.quantity} in stock
                            </span>
                          </div>
                        </div>
                        {item.location && (
                          <p className="text-sm text-purple-600 mt-2">📍 Location: {item.location}</p>
                        )}
                        <p className="text-xs text-green-600 mt-1">
                          Match confidence: {Math.round((item.matchScore / 10) * 100)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-4">🖼️</div>
              <p>Upload an image to find matching items</p>
              {matchMessage && <p className="text-sm text-gray-400 mt-2">{matchMessage}</p>}
            </div>
          )}
        </div>
      </div>

      {selectedImage && (
        <div className="mt-6 bg-green-50 p-6 rounded-lg border border-green-200">
          <h3 className="text-lg font-semibold text-green-800 mb-2">Selected Item Reference</h3>
          <p className="text-green-700 mb-4">
            Show this to the Main Stores team for assistance
          </p>
          <img 
            src={selectedImage} 
            alt="Selected" 
            className="max-h-48 rounded-lg border-2 border-green-400"
          />
          <button
            onClick={() => setSelectedImage(null)}
            className="mt-4 text-sm text-green-600 hover:text-green-800"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-800">How AI Search works:</h3>
        <ol className="text-sm text-blue-700 mt-2 space-y-1">
          <li>1. Upload a photo of the item you need</li>
          <li>2. AI analyzes the image to identify what it is</li>
          <li>3. Smart matching finds related items in inventory</li>
          <li>4. Show the match to Main Stores team for help locating it</li>
        </ol>
      </div>
    </div>
  );
};

export default ImageSearch;
