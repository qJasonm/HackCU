import { useState, useEffect, useRef } from 'react';
import './Closet.css';

function Closet() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Top');
  const [category, setCategory] = useState('Casual');
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [filterType, setFilterType] = useState('All');
  
  const fileInputRef = useRef(null);

  const fetchCloset = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/closet');
      if (!res.ok) throw new Error('Failed to fetch closet');
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
      setError('Could not load closet items.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCloset();
  }, []);

  const generateDescription = async (base64Image) => {
    setIsGeneratingDesc(true);
    setDescription('AI is looking at the clothing...');
    try {
      const res = await fetch('http://localhost:3001/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Output ONLY a 2-5 word description of the main clothing item in this image. DO NOT include the word "description", do not use conversational filler, and do not use prefixes. Example: "Red Vintage Leather Jacket".',
          images: [base64Image]
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.response) {
            let text = data.response.replace(/\n/g, '').trim();
            // Fallback regex to aggressively strip out common AI conversational prefixes and quotes
            text = text.replace(/^(Clothing\s*)?Description:\s*/i, '');
            text = text.replace(/^Here is a.*:\s*/i, '');
            text = text.replace(/^["']|["']$/g, '');
            setDescription(text);
        } else {
            setDescription('');
        }
      } else {
        setDescription('');
      }
    } catch (err) {
      console.error('Failed to auto-describe', err);
      setDescription('');
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result); // Base64 data string
      const base64Data = reader.result.split(',')[1];
      if (base64Data) {
        generateDescription(base64Data);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!imagePreview) {
      alert("Please select an image first!");
      return;
    }

    setIsUploading(true);
    try {
      const res = await fetch('http://localhost:3001/api/closet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imagePreview,
          description,
          type,
          category
        })
      });
      
      if (!res.ok) throw new Error('Failed to save item');
      
      // Cleanup form and refresh
      setIsAdding(false);
      setDescription('');
      setType('Top');
      setCategory('Casual');
      setImagePreview(null);
      fetchCloset();
    } catch (err) {
      console.error(err);
      alert('Failed to add item to closet.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!confirm('Are you sure you want to remove this item?')) return;
    
    try {
      const res = await fetch(`http://localhost:3001/api/closet/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete');
      setItems(items.filter(item => item.id !== id));
    } catch (err) {
      console.error(err);
      alert('Could not delete item.');
    }
  };

  const filteredItems = items.filter(item => filterType === 'All' || item.type === filterType);

  return (
    <div className="closet-container">
      <div className="closet-header">
        <h1 className="closet-title">Digital Closet</h1>
        <button 
          className="add-btn" 
          onClick={() => {
            const willBeAdding = !isAdding;
            setIsAdding(willBeAdding);
            if (!willBeAdding) {
              setDescription('');
              setImagePreview(null);
            }
          }}
        >
          {isAdding ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      <div className="closet-filters" style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '10px' }}>
        {['All', 'Top', 'Bottom', 'Shoes', 'Accessory', 'Full Outfit'].map(f => (
          <button 
            key={f} 
            onClick={() => setFilterType(f)}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '20px', 
              border: 'none', 
              backgroundColor: filterType === f ? '#ff4c8b' : '#2a2a40',
              color: 'white',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {isAdding && (
        <div className="add-item-form">
          <h3>Add New Clothing</h3>
          <form onSubmit={handleAddItem}>
            <div className="form-group">
              <label>Upload Image</label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageSelect}
                ref={fileInputRef}
                style={{ display: 'none' }}
              />
              <div 
                className="image-upload-box" 
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="upload-preview" />
                ) : (
                  <span>Click to select picture</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Clothing Type</label>
              <select value={type} onChange={e => setType(e.target.value)}>
                <option value="Top">Top (Shirt, Jacket)</option>
                <option value="Bottom">Bottom (Pants, Skirt)</option>
                <option value="Shoes">Shoes</option>
                <option value="Accessory">Accessory</option>
                <option value="Full Outfit">Full Outfit</option>
              </select>
            </div>

            <div className="form-group">
              <label>Category (Occasion)</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                <option value="Casual">Casual</option>
                <option value="Formal">Formal</option>
                <option value="Work">Work / Business</option>
                <option value="Workout">Workout / Active</option>
                <option value="Party">Party / Night Out</option>
                <option value="Lounge">Lounge / Sleepwear</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                Description {isGeneratingDesc && <span style={{color: '#a08cff', fontStyle: 'italic'}}>(Auto-generating...)</span>}
              </label>
              <input 
                type="text" 
                placeholder="e.g., Red Vintage Leather Jacket" 
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={isGeneratingDesc}
                required
              />
            </div>

            <button type="submit" className="save-btn" disabled={isUploading || !imagePreview}>
              {isUploading ? 'Saving...' : 'Save to Closet'}
            </button>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="loading-state">Loading closet...</div>
      ) : error ? (
        <div className="error-state">{error}</div>
      ) : items.length === 0 ? (
        <div className="empty-closet">
          <p>Your closet is empty. Add some clothes to get started!</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="empty-closet">
          <p>No {filterType.toLowerCase()}s found in your closet.</p>
        </div>
      ) : (
        <div className="closet-grid">
          {filteredItems.map(item => (
            <div key={item.id} className="closet-card">
              <img src={item.imageUrl} alt={item.description} className="card-image" />
              <div className="card-info">
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <span className={`type-badge ${item.type.toLowerCase().replace(' ', '-')}`}>
                    {item.type}
                  </span>
                  {item.category && (
                    <span className="type-badge" style={{ backgroundColor: '#4a4a6a' }}>
                      {item.category}
                    </span>
                  )}
                </div>
                <p className="card-desc">{item.description}</p>
                <button 
                  className="delete-btn"
                  onClick={() => handleDeleteItem(item.id)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Closet;
