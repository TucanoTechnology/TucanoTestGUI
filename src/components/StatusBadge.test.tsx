import { fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import specJson from '../../api/openapi.json?raw';
import StatusBadge, {
  SIZE_CLASSES,
  STATUS_CONFIG,
  VALID_STATUSES,
  type TestCaseStatus,
} from './StatusBadge';

/**
 * Contract tests for the status taxonomy (issue #77).
 *
 * The badge vocabulary is owned by the API, so these tests read the pinned
 * OpenAPI document instead of restating the list: if TucanoTestAPI adds or
 * renames a status, the GUI stops compiling its own vocabulary quietly and
 * fails here first. src/styles.test.ts owns the matching stylesheet rules.
 */

interface SpecSchema {
  properties?: Record<string, { enum?: string[] } | undefined>;
}

interface Spec {
  components?: { schemas?: Record<string, SpecSchema | undefined> };
}

const spec = JSON.parse(specJson) as Spec;

function enumOf(schemaName: string, property: string): string[] {
  const values = spec.components?.schemas?.[schemaName]?.properties?.[property]?.enum;
  if (!values) throw new Error(`${schemaName}.${property} has no enum in the pinned contract`);
  return values;
}

function isKnown(status: string): boolean {
  return VALID_STATUSES.includes(status as TestCaseStatus);
}

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

describe('status vocabulary', () => {
  it('renders exactly the statuses the contract defines', () => {
    const fromContract = enumOf('TestCaseResult', 'status');

    expect([...VALID_STATUSES].sort()).toEqual([...fromContract].sort());
  });

  it('accepts every status a test result may be written with', () => {
    const writable = enumOf('TestResultRequest', 'status');

    expect(writable.filter((status) => !isKnown(status))).toEqual([]);
  });

  it('accepts the narrower statuses an import may carry', () => {
    const importable = enumOf('ImportEntry', 'status');

    expect(importable.length).toBeGreaterThan(0);
    expect(importable.filter((status) => !isKnown(status))).toEqual([]);
  });
});

describe('StatusBadge', () => {
  it('renders every status with its own label, icon and variant', () => {
    render(
      <div>
        {VALID_STATUSES.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </div>,
    );

    for (const status of VALID_STATUSES) {
      const config = STATUS_CONFIG[status];
      const badge = screen.getByRole('status', { name: `Status: ${config.label}` });

      expect(badge.className.split(/\s+/)).toContain(config.className);
      expect(badge.textContent?.includes(config.label)).toBe(true);
      expect(badge.querySelector('.badge-icon')?.textContent).toBe(config.icon);
    }
  });

  it('falls back to Untested for a status the contract does not define', () => {
    render(<StatusBadge status="Draft" />);

    expect(screen.getByRole('status', { name: 'Status: Untested' })).toBeDefined();
    expect(screen.queryByText('Draft')).toBeNull();
  });

  it('hides the icon when asked', () => {
    render(<StatusBadge status="Passed" showIcon={false} />);

    const badge = screen.getByRole('status', { name: 'Status: Passed' });
    expect(badge.querySelector('.badge-icon')).toBeNull();
  });

  it('applies the size variant it is given', () => {
    for (const [size, className] of Object.entries(SIZE_CLASSES)) {
      const { unmount } = render(<StatusBadge status="Passed" size={size as keyof typeof SIZE_CLASSES} />);

      const badge = screen.getByRole('status', { name: 'Status: Passed' });
      expect(badge.className.split(/\s+/)).toContain(className);

      unmount();
    }
  });

  it('announces the current status and lists the others when interactive', () => {
    const onStatusChange = vi.fn();
    render(<StatusBadge status="Passed" interactive onStatusChange={onStatusChange} />);

    const trigger = screen.getByRole('button', {
      name: 'Current status Passed. Click to change status.',
    });
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryAllByRole('option')).toEqual([]);

    fireEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('listbox', { name: /select test status/i })).toBeDefined();
    expect(screen.getAllByRole('option').length).toBe(VALID_STATUSES.length);
    expect(screen.getByRole('option', { name: 'Passed' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('option', { name: 'Failed' }).getAttribute('aria-selected')).toBe('false');

    fireEvent.click(screen.getByRole('option', { name: 'Failed' }));

    expect(onStatusChange).toHaveBeenCalledWith('Failed');
    expect(screen.queryAllByRole('option')).toEqual([]);
  });

  it('does not demand a change handler from the listbox', () => {
    render(<StatusBadge status="Untested" interactive />);

    fireEvent.click(screen.getByRole('button', { name: /current status untested/i }));
    fireEvent.click(screen.getByRole('option', { name: 'Retest' }));

    expect(screen.queryAllByRole('option')).toEqual([]);
  });

  it('has no detectable WCAG 2.1 AA violations', async () => {
    const { container } = render(
      <div>
        {VALID_STATUSES.map((status) => (
          <StatusBadge key={status} status={status} interactive />
        ))}
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: /current status passed/i }));
    await screen.findByRole('listbox', { name: /select test status/i });

    const results = await axe.run(container, { runOnly: { type: 'tag', values: AXE_TAGS } });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
