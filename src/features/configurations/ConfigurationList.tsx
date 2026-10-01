import { useEffect, useState } from "react";
import type { TestConfiguration } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { useProjectContext } from "../../app/ProjectContext.js";
import { Dialog } from "../../app/Dialog.js";
import {
  ConfigurationForm,
  type ConfigurationFormValues,
} from "./ConfigurationForm.js";
import { buildConfigurationCreateRequest } from "./configurationRequests.js";
import { SettingsIcon } from "../../components/Icon.js";
import { RowBreadcrumb } from "../../components/RowBreadcrumb.js";
import { EmptyState, ErrorState, LoadingSkeleton } from "../../components/StateViews.js";

interface ConfigurationListProps {
  projectId: string;
  selectedConfigId: string | null;
  onSelectConfiguration: (id: string) => void;
}

export function ConfigurationList({
  projectId,
  selectedConfigId,
  onSelectConfiguration,
}: ConfigurationListProps) {
  const { client } = useAuth();
  const { refreshProjects, announce } = useProjectContext();
  interface ConfigRow {
    key: string;
    config: TestConfiguration;
  }
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [search, setSearch] = useState("");

  const [creating, setCreating] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<ApiErrorInfo | null>(null);
  const [projectName, setProjectName] = useState(projectId);

  useEffect(() => {
    let cancelled = false;
    apiFetch(() => client.projects.getProject({ id: projectId }))
      .then((project) => {
        if (!cancelled) setProjectName(project.name ?? project.projectId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client, projectId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch(() => client.projects.listProjectConfigurations({ id: projectId }))
      .then(async (ids) => {
        const loaded = await Promise.all(
          ids.map((id) =>
            apiFetch(() => client.configurations.getConfiguration({ id })),
          ),
        );
        if (cancelled) return;
        // The listing key is what addresses the configuration: one created
        // with an explicit `configId` carries a document id that differs from
        // its key, and a rename never moves the key.
        setRows(ids.map((id, index) => ({ key: id, config: loaded[index]! })));
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(readApiError(err, "Failed to load configurations"));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId, reloadToken]);

  const createConfiguration = async (values: ConfigurationFormValues) => {
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await apiFetch(() =>
        client.projects.addProjectConfiguration({
          id: projectId,
          requestBody: buildConfigurationCreateRequest(values),
        }),
      );
      setCreating(false);
      refreshProjects();
      announce(created.message);
      onSelectConfiguration(created.id);
      setReloadToken((token) => token + 1);
    } catch (err: unknown) {
      setCreateError(readApiError(err, "Failed to create configuration"));
    } finally {
      setCreateBusy(false);
    }
  };

  const needle = search.trim().toLowerCase();
  const visible = needle
    ? rows.filter(
        (row) =>
          row.config.name.toLowerCase().includes(needle) ||
          row.key.toLowerCase().includes(needle),
      )
    : rows;

  if (loading) {
    return <LoadingSkeleton rows={5} columns={6} />;
  }

  if (error) {
    return (
      <ErrorState
        code={error.code}
        message={error.message}
        onRetry={() => setReloadToken((token) => token + 1)}
      />
    );
  }

  return (
    <div className="case-list">
      <div className="case-list__actions">
        <div className="case-list__actions-primary">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setCreateError(null);
              setCreating(true);
            }}
          >
            + New Configuration
          </button>
        </div>
        <div className="case-list__actions-secondary">
          <input
            type="search"
            className="case-list__search"
            placeholder="Search configurations…"
            aria-label="Search configurations"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<SettingsIcon />}
          message={
            rows.length === 0
              ? "No configurations yet"
              : "No configurations match the search"
          }
          action={
            rows.length === 0 ? (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setCreateError(null);
                  setCreating(true);
                }}
              >
                + New Configuration
              </button>
            ) : undefined
          }
        />
      ) : (
        <table className="case-table config-table" aria-label="Configurations">
          <thead>
            <tr>
              <th className="case-table__th">ID</th>
              <th className="case-table__th">Name</th>
              <th className="case-table__th">Browser</th>
              <th className="case-table__th">OS</th>
              <th className="case-table__th">Device</th>
              <th className="case-table__th">Resolution</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const key = row.key;
              const config = row.config;
              return (
                <tr
                  key={key}
                  className={`case-table__row ${
                    selectedConfigId === key
                      ? "case-table__row--selected"
                      : ""
                  }`}
                  onClick={() => onSelectConfiguration(key)}
                >
                  <td className="case-table__td case-table__td--id">
                    <span className="case-table__id">{key}</span>
                    <RowBreadcrumb projectName={projectName} />
                  </td>
                  <td className="case-table__td">{config.name}</td>
                  <td className="case-table__td">{config.browser ?? "—"}</td>
                  <td className="case-table__td">{config.os ?? "—"}</td>
                  <td className="case-table__td">{config.device ?? "—"}</td>
                  <td className="case-table__td">{config.resolution ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {creating && (
        <Dialog title="New configuration" onClose={() => setCreating(false)}>
          <ConfigurationForm
            submitLabel="Create configuration"
            busy={createBusy}
            error={createError}
            onSubmit={createConfiguration}
            onCancel={() => setCreating(false)}
          />
        </Dialog>
      )}
    </div>
  );
}
