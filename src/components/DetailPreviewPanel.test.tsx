import { fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import DetailPreviewPanel from './DetailPreviewPanel';

type PanelProps = Parameters<typeof DetailPreviewPanel>[0];

function renderPanel(overrides: Partial<PanelProps> = {}) {
  const props: PanelProps = {
    label: 'Project details preview',
    heading: 'Project PROJ-1.json',
    state: 'ready',
    onClose: vi.fn(),
    ...overrides,
  };
  return render(<DetailPreviewPanel {...props} />);
}

describe('DetailPreviewPanel', () => {
  it('renders a labelled region headed by the previewed entity', () => {
    renderPanel();

    expect(screen.getByRole('region', { name: 'Project details preview' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Project PROJ-1.json' })).toBeDefined();
  });

  it('shows the empty hint and announces that nothing is selected', () => {
    renderPanel({ state: 'empty', heading: 'No project selected' });

    expect(screen.getByText(/select an item in the list to preview it here/i)).toBeDefined();
    expect(screen.getByText('No item selected.').getAttribute('aria-live')).toBe('polite');
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('accepts a module-specific empty hint', () => {
    renderPanel({ state: 'empty', emptyHint: 'Choose a project in the list.' });

    expect(screen.getByText('Choose a project in the list.')).toBeDefined();
  });

  it('announces the loading state', () => {
    renderPanel({ state: 'loading' });

    expect(screen.getByText('Fetching details…')).toBeDefined();
    expect(screen.getByText('Loading details for Project PROJ-1.json.')).toBeDefined();
  });

  it('surfaces the API error envelope without hiding the code', () => {
    renderPanel({
      state: 'error',
      failure: { code: 'not_found', message: 'Project PROJ-1.json could not be read' },
    });

    expect(
      screen.getByText(/could not load details: project PROJ-1\.json could not be read/i),
    ).toBeDefined();
    expect(screen.getByText('Error code: not_found')).toBeDefined();
    expect(screen.getByText('Could not load details for Project PROJ-1.json.')).toBeDefined();
  });

  it('renders nothing but the header when the error carries no envelope', () => {
    const { container } = renderPanel({ state: 'error' });

    expect(container.querySelector('.module-error')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Project PROJ-1.json' })).toBeDefined();
  });

  it('renders the entity fields and announces the ready state', () => {
    renderPanel({
      fields: [
        { label: 'Project ID', value: 'PROJ-1.json' },
        { label: 'Name', value: 'Checkout App' },
      ],
    });

    // The label is its own element, so pair it back with its value.
    expect(screen.getByText('Project ID:').closest('p')?.textContent).toBe('Project ID: PROJ-1.json');
    expect(screen.getByText('Name:').closest('p')?.textContent).toBe('Name: Checkout App');
    expect(screen.getByText('Showing details for Project PROJ-1.json.')).toBeDefined();
  });

  it('renders linked entries and falls back to a none-linked message', () => {
    renderPanel({
      linkLists: [
        { heading: 'Linked test suites', entries: ['SmokeTest.json', 'Regression.json'] },
        { heading: 'Linked milestones', entries: [] },
      ],
    });

    expect(screen.getByRole('heading', { name: 'Linked test suites (2)' })).toBeDefined();
    expect(screen.getByText('SmokeTest.json')).toBeDefined();
    expect(screen.getByText('Regression.json')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Linked milestones (0)' })).toBeDefined();
    expect(screen.getByText('None linked.')).toBeDefined();
  });

  it('calls onClose from the header control', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offers only the actions the owning module provides', () => {
    renderPanel({ onEdit: vi.fn() });

    expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Duplicate' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('invokes the quick actions the module wired up', () => {
    const onEdit = vi.fn();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    renderPanel({ onEdit, onDuplicate, onDelete });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('has no detectable WCAG 2.1 AA violations while previewing an entity', async () => {
    const { container } = renderPanel({
      fields: [
        { label: 'Project ID', value: 'PROJ-1.json' },
        { label: 'Name', value: 'Checkout App' },
      ],
      linkLists: [{ heading: 'Linked test suites', entries: ['SmokeTest.json'] }],
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('has no detectable WCAG 2.1 AA violations in the error state', async () => {
    const { container } = renderPanel({
      state: 'error',
      failure: { code: 'not_found', message: 'Project PROJ-1.json could not be read' },
    });

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
