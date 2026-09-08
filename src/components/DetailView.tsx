import { useState, useEffect } from 'react';
import DuplicateButton from './DuplicateButton';

export type DetailItemType = 'case' | 'suite' | 'project' | 'run' | 'milestone';

export interface DetailViewProps {
  itemId: string | null;
  itemType: DetailItemType;
  onClose: () => void;
}

export default function DetailView({ itemId, itemType, onClose }: DetailViewProps) {
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!itemId) {
      setItem(null);
      return;
    }

    const fetchItem = async () => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = `/api/${itemType}s/${encodeURIComponent(itemId)}`;
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error('Failed to fetch item');
        const data = await response.json();
        setItem(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [itemId, itemType]);

  const handleSave = async () => {
    if (!item || !itemId) return;
    try {
      const endpoint = `/api/${itemType}s/${encodeURIComponent(itemId)}`;
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (!response.ok) throw new Error('Failed to save');
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handleDelete = async () => {
    if (!itemId || !window.confirm('Are you sure you want to delete this item?')) return;
    try {
      const endpoint = `/api/${itemType}s/${encodeURIComponent(itemId)}`;
      const response = await fetch(endpoint, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleDuplicate = (newId: string) => {
    alert(`Item duplicated as: ${newId}`);
  };

  if (!itemId) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6c757d' }}>
        <p>Select an item to view details</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6c757d' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#dc3545' }}>
        <p>Error: {error}</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: '12px' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!item) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6c757d' }}>
        <p>Item not found</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #dee2e6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
          {itemType === 'case' && 'Test Case'}
          {itemType === 'suite' && 'Test Suite'}
          {itemType === 'project' && 'Project'}
          {itemType === 'run' && 'Test Run'}
          {itemType === 'milestone' && 'Milestone'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#6c757d',
            padding: '4px 8px',
          }}
          aria-label="Close detail panel"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {itemType === 'case' && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#495057' }}>
                Title
              </label>
              {editing ? (
                <input
                  type="text"
                  value={item.title || ''}
                  onChange={(e) => setItem({ ...item, title: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
              ) : (
                <div style={{ fontSize: '14px', fontWeight: 500 }}>{item.title}</div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#495057' }}>
                Description
              </label>
              {editing ? (
                <textarea
                  value={item.description || ''}
                  onChange={(e) => setItem({ ...item, description: e.target.value })}
                  rows={4}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
              ) : (
                <div style={{ fontSize: '14px', color: '#495057' }}>{item.description || 'No description'}</div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#495057' }}>
                Expected Result
              </label>
              {editing ? (
                <textarea
                  value={item.expectedResult || ''}
                  onChange={(e) => setItem({ ...item, expectedResult: e.target.value })}
                  rows={3}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
              ) : (
                <div style={{ fontSize: '14px', color: '#495057' }}>{item.expectedResult || 'Not specified'}</div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#495057' }}>
                Priority
              </label>
              {editing ? (
                <select
                  value={item.priority || 'Medium'}
                  onChange={(e) => setItem({ ...item, priority: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              ) : (
                <div style={{ fontSize: '14px' }}>{item.priority || 'Medium'}</div>
              )}
            </div>

            {item.steps && item.steps.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#495057' }}>
                  Steps
                </label>
                <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
                  {item.steps.map((step: string, idx: number) => (
                    <li key={idx} style={{ marginBottom: '4px' }}>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}

        {itemType === 'suite' && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#495057' }}>
                Name
              </label>
              {editing ? (
                <input
                  type="text"
                  value={item.name || ''}
                  onChange={(e) => setItem({ ...item, name: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
              ) : (
                <div style={{ fontSize: '14px', fontWeight: 500 }}>{item.name}</div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#495057' }}>
                Description
              </label>
              {editing ? (
                <textarea
                  value={item.description || ''}
                  onChange={(e) => setItem({ ...item, description: e.target.value })}
                  rows={4}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
              ) : (
                <div style={{ fontSize: '14px', color: '#495057' }}>{item.description || 'No description'}</div>
              )}
            </div>

            {item.testCases && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#495057' }}>
                  Test Cases ({item.testCases.length})
                </label>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
                  {item.testCases.map((tc: any) => (
                    <li key={tc.testCaseId} style={{ marginBottom: '4px' }}>
                      {tc.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {itemType === 'project' && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#495057' }}>
                Name
              </label>
              {editing ? (
                <input
                  type="text"
                  value={item.name || ''}
                  onChange={(e) => setItem({ ...item, name: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
              ) : (
                <div style={{ fontSize: '14px', fontWeight: 500 }}>{item.name}</div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#495057' }}>
                Description
              </label>
              {editing ? (
                <textarea
                  value={item.description || ''}
                  onChange={(e) => setItem({ ...item, description: e.target.value })}
                  rows={4}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
              ) : (
                <div style={{ fontSize: '14px', color: '#495057' }}>{item.description || 'No description'}</div>
              )}
            </div>

            {item.testSuites && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#495057' }}>
                  Test Suites ({item.testSuites.length})
                </label>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
                  {item.testSuites.map((suite: any) => (
                    <li key={suite.suiteId} style={{ marginBottom: '4px' }}>
                      {suite.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {(itemType === 'run' || itemType === 'milestone') && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#495057' }}>
                Name
              </label>
              {editing ? (
                <input
                  type="text"
                  value={item.name || ''}
                  onChange={(e) => setItem({ ...item, name: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
              ) : (
                <div style={{ fontSize: '14px', fontWeight: 500 }}>{item.name}</div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#495057' }}>
                Description
              </label>
              {editing ? (
                <textarea
                  value={item.description || ''}
                  onChange={(e) => setItem({ ...item, description: e.target.value })}
                  rows={4}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
              ) : (
                <div style={{ fontSize: '14px', color: '#495057' }}>{item.description || 'No description'}</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid #dee2e6',
          display: 'flex',
          gap: '8px',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          {editing ? (
            <>
              <button
                type="button"
                onClick={handleSave}
                style={{
                  padding: '8px 16px',
                  background: '#28a745',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                style={{
                  padding: '8px 16px',
                  background: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                style={{
                  padding: '8px 16px',
                  background: '#0066cc',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Edit
              </button>
              <DuplicateButton
                resourceId={itemId}
                resourceType={itemType as any}
                onDuplicate={handleDuplicate}
              />
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleDelete}
          style={{
            padding: '8px 16px',
            background: '#dc3545',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
