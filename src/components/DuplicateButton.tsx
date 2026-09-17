import { useMemo, useState } from 'react';
import { apiErrorEnvelope, createApiClient, type ApiErrorEnvelope } from '../api/configure';
import type { CreateResponse, DuplicateRequest, TucanoApi } from '../api/generated';

/** Every resource the API publishes a duplicate route for. */
export type DuplicableResource = 'project' | 'suite' | 'case' | 'run' | 'milestone';

export interface DuplicateButtonProps {
  resourceId: string;
  resourceType: DuplicableResource;
  onDuplicate: (newId: string) => void;
  disabled?: boolean;
  /** The configured client to duplicate through; one is built when absent. */
  client?: TucanoApi;
}

export default function DuplicateButton({ resourceId, resourceType, onDuplicate, disabled = false, client }: DuplicateButtonProps) {
  const api = useMemo(() => client ?? createApiClient(), [client]);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [newId, setNewId] = useState('');
  const [failure, setFailure] = useState<ApiErrorEnvelope | null>(null);

  const duplicate = (requestBody: DuplicateRequest): Promise<CreateResponse> => {
    switch (resourceType) {
      case 'project':
        return api.projects.duplicateProject({ id: resourceId, requestBody });
      case 'suite':
        return api.testSuites.duplicateTestSuite({ id: resourceId, requestBody });
      case 'case':
        return api.testCases.duplicateTestCase({ id: resourceId, requestBody });
      case 'run':
        return api.testRuns.duplicateTestRun({ id: resourceId, requestBody });
      case 'milestone':
        return api.milestones.duplicateMilestone({ id: resourceId, requestBody });
    }
  };

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    setFailure(null);

    let copy: CreateResponse | null = null;
    try {
      copy = await duplicate(newId ? { newId } : {});
    } catch (error) {
      setFailure(
        apiErrorEnvelope(error) ?? {
          code: 'network_error',
          message: `The API could not be reached to duplicate the ${resourceType}.`,
        },
      );
    } finally {
      setIsDuplicating(false);
    }

    if (!copy) return;
    setShowInput(false);
    setNewId('');
    onDuplicate(copy.id);
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
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
              aria-label={`New ${resourceType} ID (optional)`}
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

      {failure && (
        <div className="module-error" role="alert">
          <p>
            Could not duplicate the {resourceType}: {failure.message}
          </p>
          <p className="module-error-code">Error code: {failure.code}</p>
        </div>
      )}
    </div>
  );
}
