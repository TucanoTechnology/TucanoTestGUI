import React, { useState, useEffect } from 'react';
import DuplicateButton from './DuplicateButton';
import EntityTags from './EntityTags';
import StatusBadge from './StatusBadge';
import AttachmentsPanel from '../features/test-cases/AttachmentsPanel';
import type { Attachment } from '../api/generated';
import { TestResultStatus, TEST_RESULT_STATUSES, TucanoApiClient } from '../api/client';

export type DetailItemType = 'case' | 'suite' | 'project' | 'run' | 'milestone';

export interface DetailViewProps {
  itemId: string | null;
  itemType: DetailItemType;
  client?: TucanoApiClient;
  breadcrumb?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPassAndNext?: () => void;
  /**
   * The status the selected run recorded for this case, or `null` when it holds
   * none. Run-scoped (issue #65): the case document carries no status, so a
   * missing run or result renders an empty state instead of a value.
   */
  recordedStatus?: TestResultStatus | null;
  /** Whether a run is selected at all; gates the controls that record a result. */
  runSelected?: boolean;
  onRecordResult?: (status: TestResultStatus, notes: string) => Promise<void>;
  onItemUpdated?: () => void;
  onItemDeleted?: () => void;
}

export default function DetailView({
  itemId,
  itemType,
  client,
  breadcrumb,
  onClose,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  onPassAndNext,
  recordedStatus = null,
  runSelected = false,
  onRecordResult,
  onItemUpdated,
  onItemDeleted,
}: DetailViewProps) {
  const api = React.useMemo(() => client ?? new TucanoApiClient(), [client]);
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'results' | 'attachments'>('details');

  // Inline result recorder state
  const [resultStatus, setResultStatus] = useState<TestResultStatus>('Passed');
  const [resultNotes, setResultNotes] = useState('');
  const [isSubmittingResult, setIsSubmittingResult] = useState(false);

  // Attachment state
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    if (!itemId) {
      setItem(null);
      return;
    }

    const fetchItem = async () => {
      setLoading(true);
      setError(null);
      try {
        let data: any;
        if (itemType === 'case') {
          data = await api.getTestCase(itemId);
        } else if (itemType === 'suite') {
          data = await api.getTestSuite(itemId);
        } else if (itemType === 'project') {
          data = await api.getProject(itemId);
        } else if (itemType === 'run') {
          data = await api.getTestRun(itemId);
        } else if (itemType === 'milestone') {
          data = await api.getMilestone(itemId);
        }
        setItem(data);
        setAttachments(itemType === 'case' ? data?.attachments ?? [] : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [itemId, itemType, api]);

  const handleSave = async () => {
    if (!item || !itemId) return;
    try {
      if (itemType === 'case') {
        await api.updateTestCase(itemId, item);
      } else if (itemType === 'suite') {
        await api.updateTestSuite(itemId, item);
      } else if (itemType === 'project') {
        await api.updateProject(itemId, item);
      } else if (itemType === 'run') {
        await api.updateTestRun(itemId, item);
      } else if (itemType === 'milestone') {
        await api.updateMilestone(itemId, item);
      }
      setEditing(false);
      onItemUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handleDelete = async () => {
    if (!itemId || !window.confirm(`Are you sure you want to delete this ${itemType}?`)) return;
    try {
      if (itemType === 'case') {
        await api.deleteTestCase(itemId);
      } else if (itemType === 'suite') {
        await api.deleteTestSuite(itemId);
      } else if (itemType === 'project') {
        await api.deleteProject(itemId);
      } else if (itemType === 'run') {
        await api.deleteTestRun(itemId);
      } else if (itemType === 'milestone') {
        await api.deleteMilestone(itemId);
      }
      onItemDeleted?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleDuplicate = (newId: string) => {
    alert(`Item duplicated as: ${newId}`);
    onItemUpdated?.();
  };

  /**
   * Recording an outcome writes to the selected run only. The case document
   * keeps its priority and severity untouched (issue #65); the pane re-renders
   * from the status the owner passes back down.
   */
  const handleSubmitResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onRecordResult || !runSelected) return;
    setIsSubmittingResult(true);
    try {
      await onRecordResult(resultStatus, resultNotes);
      setResultNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record result');
    } finally {
      setIsSubmittingResult(false);
    }
  };

  if (!itemId) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', color: '#64748b' }}>
        <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>📋</span>
        <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 6px 0', color: '#1e293b' }}>
          No item selected
        </h3>
        <p style={{ fontSize: '13px', margin: 0, color: '#94a3b8' }}>
          Click on any row in the test case table to view and edit its details.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', color: '#64748b' }}>
        <p style={{ fontSize: '14px', margin: 0 }}>Loading details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#b91c1c' }}>
        <p style={{ fontSize: '14px', fontWeight: 600 }}>Error: {error}</p>
        <button
          type="button"
          onClick={() => setEditing(false)}
          style={{
            marginTop: '12px',
            padding: '6px 14px',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (!item) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
        <p>Item not found.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#ffffff',
        borderLeft: '1px solid #e2e8f0',
      }}
    >
      {/* Sticky Panel Toolbar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          background: '#ffffff',
          zIndex: 20,
          padding: '10px 16px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        {/* Left Toolbar Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {itemType === 'case' && onPassAndNext && (
            <button
              type="button"
              onClick={onPassAndNext}
              disabled={!runSelected}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 12px',
                background: '#15803d',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: runSelected ? 'pointer' : 'not-allowed',
                opacity: runSelected ? 1 : 0.6,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
              title={
                runSelected
                  ? 'Mark Passed & advance to next test case'
                  : 'Select a test run before recording a result'
              }
            >
              <span>✓ Pass & next</span>
            </button>
          )}

          {itemType === 'case' && (
            <button
              type="button"
              onClick={() => setActiveTab('results')}
              style={{
                padding: '5px 10px',
                background: activeTab === 'results' ? '#e0f2fe' : '#f8fafc',
                color: activeTab === 'results' ? '#0369a1' : '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Add result
            </button>
          )}
        </div>

        {/* Right Toolbar Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              disabled={!hasPrev}
              style={{
                padding: '4px 8px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                cursor: hasPrev ? 'pointer' : 'not-allowed',
                opacity: hasPrev ? 1 : 0.4,
                fontSize: '12px',
              }}
              aria-label="Previous test case"
            >
              ◀
            </button>
          )}

          {onNext && (
            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext}
              style={{
                padding: '4px 8px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                cursor: hasNext ? 'pointer' : 'not-allowed',
                opacity: hasNext ? 1 : 0.4,
                fontSize: '12px',
              }}
              aria-label="Next test case"
            >
              ▶
            </button>
          )}

          <DuplicateButton resourceId={itemId} resourceType={itemType} onDuplicate={handleDuplicate} />

          <button
            type="button"
            onClick={() => setEditing(!editing)}
            style={{
              padding: '4px 8px',
              background: editing ? '#fef3c7' : '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              color: editing ? '#92400e' : '#334155',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
            aria-label="Edit item"
          >
            {editing ? 'Cancel' : '✎ Edit'}
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#64748b',
              padding: '2px 8px',
              marginLeft: '4px',
            }}
            aria-label="Close detail panel"
          >
            ×
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {/* Breadcrumb path */}
        <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '6px' }}>
          {breadcrumb || `All Test Cases / ${itemId}`}
        </div>

        {/* Item Title & Status Pill */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            {editing ? (
              <input
                type="text"
                value={item.title || item.name || ''}
                onChange={(e) =>
                  itemType === 'case'
                    ? setItem({ ...item, title: e.target.value })
                    : setItem({ ...item, name: e.target.value })
                }
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  fontSize: '16px',
                  fontWeight: 600,
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              />
            ) : (
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                {item.title || item.name}
              </h3>
            )}
            <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', marginTop: '4px' }}>
              ID: {itemId}
            </div>
          </div>

          {itemType === 'case' &&
            (recordedStatus ? (
              <StatusBadge status={recordedStatus} size="medium" />
            ) : (
              <span className="case-result-empty">
                {runSelected ? 'No result yet' : 'No run selected'}
              </span>
            ))}
        </div>

        {/* Metadata Grid Card */}
        {itemType === 'case' && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 14px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: '10px',
              marginBottom: '20px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Template
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginTop: '2px' }}>
                📄 Steps
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Priority
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginTop: '2px' }}>
                {item.priority || 'Medium'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Severity
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginTop: '2px' }}>
                {item.severity || 'Major'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Test Type
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginTop: '2px' }}>
                {item.testType || 'Functional'}
              </div>
            </div>
          </div>
        )}

        {/* Local Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            marginBottom: '16px',
            gap: '16px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            style={{
              padding: '8px 4px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'details' ? '2px solid #0f766e' : '2px solid transparent',
              color: activeTab === 'details' ? '#0f766e' : '#64748b',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Steps & Description
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('results')}
            style={{
              padding: '8px 4px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'results' ? '2px solid #0f766e' : '2px solid transparent',
              color: activeTab === 'results' ? '#0f766e' : '#64748b',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Execution & Results
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attachments')}
            style={{
              padding: '8px 4px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'attachments' ? '2px solid #0f766e' : '2px solid transparent',
              color: activeTab === 'attachments' ? '#0f766e' : '#64748b',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Attachments ({attachments.length})
          </button>
        </div>

        {/* Tab 1: Details & Steps */}
        {activeTab === 'details' && (
          <div>
            {/* Tags (issue #62): the control reads and writes them itself.
                Milestones are the one item type whose contract carries none. */}
            {itemType !== 'milestone' && (
              <EntityTags resourceType={itemType} resourceId={itemId} />
            )}

            {/* Description */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                Description
              </div>
              {editing ? (
                <textarea
                  value={item.description || ''}
                  onChange={(e) => setItem({ ...item, description: e.target.value })}
                  rows={3}
                  style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              ) : (
                <p style={{ margin: 0, fontSize: '13.5px', color: '#334155', lineHeight: 1.5 }}>
                  {item.description || 'No description provided.'}
                </p>
              )}
            </div>

            {/* Preconditions */}
            {item.preconditions && (
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Preconditions
                </div>
                <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', color: '#334155' }}>
                  {item.preconditions}
                </div>
              </div>
            )}

            {/* Steps & Expected Results */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
                Test Steps
              </div>
              {item.steps && item.steps.length > 0 ? (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  {item.steps.map((step: any, idx: number) => {
                    const action = typeof step === 'string' ? step : step.action;
                    const expected = typeof step === 'object' && step?.expectedResult ? step.expectedResult : null;

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 14px',
                          borderBottom: idx < item.steps.length - 1 ? '1px solid #f1f5f9' : 'none',
                          background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <span style={{ fontWeight: 700, color: '#0f766e', fontSize: '13px' }}>
                            {idx + 1}.
                          </span>
                          <div style={{ flex: 1, fontSize: '13.5px', color: '#1e293b' }}>
                            {action}
                          </div>
                        </div>
                        {expected && (
                          <div
                            style={{
                              marginLeft: '20px',
                              marginTop: '4px',
                              fontSize: '12.5px',
                              color: '#15803d',
                              fontWeight: 500,
                            }}
                          >
                            ↳ <em>Expected:</em> {expected}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>No steps documented.</p>
              )}
            </div>

            {/* Overall Expected Result */}
            {item.expectedResult && (
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Expected Result
                </div>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: '6px', fontSize: '13px', color: '#166534' }}>
                  {item.expectedResult}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Execution & Results */}
        {activeTab === 'results' && (
          <div>
            <form onSubmit={handleSubmitResult} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '10px' }}>
                Record Test Result
              </div>

              {!runSelected && (
                <p className="case-result-empty" style={{ margin: '0 0 10px 0' }}>
                  Select a test run on the board before recording a result.
                </p>
              )}

              {/* Status choice pills */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {TEST_RESULT_STATUSES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={!runSelected}
                    onClick={() => setResultStatus(st)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: runSelected ? 'pointer' : 'not-allowed',
                      opacity: runSelected ? 1 : 0.6,
                      border: resultStatus === st ? '2px solid #0f766e' : '1px solid #cbd5e1',
                      background: resultStatus === st ? '#e0f2fe' : '#ffffff',
                      color: resultStatus === st ? '#0369a1' : '#475569',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Notes input */}
              <div style={{ marginBottom: '12px' }}>
                <textarea
                  value={resultNotes}
                  onChange={(e) => setResultNotes(e.target.value)}
                  disabled={!runSelected}
                  aria-label="Result notes"
                  placeholder="Add execution comments or defect notes..."
                  rows={3}
                  style={{ width: '100%', padding: '8px', fontSize: '12.5px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingResult || !runSelected}
                style={{
                  background: '#0f766e',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isSubmittingResult || !runSelected ? 'not-allowed' : 'pointer',
                  opacity: isSubmittingResult || !runSelected ? 0.6 : 1,
                }}
              >
                {isSubmittingResult ? 'Saving...' : 'Record Result'}
              </button>
            </form>
          </div>
        )}

        {/* Tab 3: Attachments — the evidence panel owns the read, upload and delete. */}
        {activeTab === 'attachments' && (
          <div>
            {itemType === 'case' ? (
              <AttachmentsPanel testCaseId={itemId} onAttachmentsChanged={setAttachments} />
            ) : (
              <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', margin: '20px 0' }}>
                Attachments belong to test cases.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {editing && (
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={handleDelete}
            style={{
              padding: '6px 12px',
              background: '#fee2e2',
              border: 'none',
              borderRadius: '6px',
              color: '#b91c1c',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Delete {itemType}
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setEditing(false)}
              style={{
                padding: '6px 12px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12.5px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                padding: '6px 14px',
                background: '#0f766e',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
