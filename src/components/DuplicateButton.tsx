import { useState } from 'react';

export interface DuplicateButtonProps {
  resourceId: string;
  resourceType: 'project' | 'suite' | 'case' | 'run';
  onDuplicate: (newId: string) => void;
  disabled?: boolean;
}

export default function DuplicateButton({ resourceId, resourceType, onDuplicate, disabled = false }: DuplicateButtonProps) {
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [newId, setNewId] = useState('');

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      const response = await fetch(`/api/${resourceType}s/${encodeURIComponent(resourceId)}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newId ? { newId } : {}),
      });

      if (!response.ok) {
        throw new Error('Duplicate failed');
      }

      const result = await response.json();
      onDuplicate(result.id);
      setShowInput(false);
      setNewId('');
    } catch (error) {
      console.error('Duplicate error:', error);
    } finally {
      setIsDuplicating(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => setShowInput(!showInput)}
        disabled={disabled || isDuplicating}
        style={{
          padding: '6px 12px',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          background: '#ffffff',
          color: '#495057',
          cursor: disabled || isDuplicating ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
        title={`Duplicate ${resourceType}`}
      >
        <span>⧉</span>
        <span>{isDuplicating ? 'Duplicating...' : 'Duplicate'}</span>
      </button>

      {showInput && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder={`New ${resourceType} ID (optional)`}
            style={{
              padding: '6px 12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '14px',
              minWidth: '200px',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleDuplicate();
              if (e.key === 'Escape') {
                setShowInput(false);
                setNewId('');
              }
            }}
          />
          <button
            type="button"
            onClick={handleDuplicate}
            disabled={isDuplicating}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: '4px',
              background: '#0066cc',
              color: '#ffffff',
              cursor: isDuplicating ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            }}
          >
            {isDuplicating ? '...' : 'Confirm'}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowInput(false);
              setNewId('');
            }}
            style={{
              padding: '6px 12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              background: '#ffffff',
              color: '#495057',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
