import { useId } from "react";
import type { TestConfiguration } from "../../api/generated/index.js";

interface RunConfigurationsSectionProps {
  runConfigurations: TestConfiguration[];
  availableConfigurations: TestConfiguration[];
  homeProjectId: string | undefined;
  linkConfigId: string;
  onLinkConfigIdChange: (id: string) => void;
  onLink: (configId: string) => void;
  onUnlink: (configId: string) => void;
  busy: boolean;
  loading: boolean;
}

export function RunConfigurationsSection({
  runConfigurations,
  availableConfigurations,
  homeProjectId,
  linkConfigId,
  onLinkConfigIdChange,
  onLink,
  onUnlink,
  busy,
  loading,
}: RunConfigurationsSectionProps) {
  const fieldId = useId();

  const linked = runConfigurations;
  const linkable = availableConfigurations.filter(
    (entry) => !linked.some((held) => held.configId === entry.configId),
  );

  return (
    <div className="detail-field">
      <div className="detail-field__label">
        Configurations ({linked.length})
      </div>
      {linked.length === 0 ? (
        <div className="detail-field__value">None</div>
      ) : (
        <ul className="entity-list">
          {linked.map((entry) => (
            <li key={entry.configId} className="entity-list__item">
              <span className="entity-list__name">{entry.name}</span>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => onUnlink(entry.configId ?? "")}
              >
                Unlink
              </button>
            </li>
          ))}
        </ul>
      )}
      {homeProjectId && (
        <div className="run-detail__link">
          <label htmlFor={`${fieldId}-link-configuration`}>
            Link configuration
          </label>
          <select
            id={`${fieldId}-link-configuration`}
            value={linkConfigId}
            disabled={busy || loading}
            onChange={(event) => onLinkConfigIdChange(event.target.value)}
          >
            <option value="">
              {loading ? "Loading…" : "Choose a configuration"}
            </option>
            {linkable.map((entry) => (
              <option key={entry.configId} value={entry.configId ?? ""}>
                {entry.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || linkConfigId === ""}
            onClick={() => {
              onLink(linkConfigId);
              onLinkConfigIdChange("");
            }}
          >
            Link
          </button>
        </div>
      )}
    </div>
  );
}
