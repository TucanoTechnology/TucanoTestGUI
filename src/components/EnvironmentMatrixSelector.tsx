import { useState, useEffect } from 'react';

export interface Configuration {
  configId: string;
  name: string;
  browser?: string;
  os?: string;
  device?: string;
  resolution?: string;
}

export interface EnvironmentMatrixSelectorProps {
  selectedConfigs: string[];
  onChange: (configIds: string[]) => void;
  disabled?: boolean;
}

export default function EnvironmentMatrixSelector({
  selectedConfigs,
  onChange,
  disabled = false,
}: EnvironmentMatrixSelectorProps) {
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfigurations = async () => {
      try {
        const response = await fetch('/api/configurations');
        if (!response.ok) throw new Error('Failed to fetch configurations');
        const data = await response.json();
        setConfigurations(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchConfigurations();
  }, []);

  const handleToggle = (configId: string) => {
    if (selectedConfigs.includes(configId)) {
      onChange(selectedConfigs.filter((id) => id !== configId));
    } else {
      onChange([...selectedConfigs, configId]);
    }
  };

  if (loading) {
    return <div style={{ padding: '12px', color: '#6c757d' }}>Loading configurations...</div>;
  }

  if (error) {
    return <div style={{ padding: '12px', color: '#dc3545' }}>Error: {error}</div>;
  }

  if (configurations.length === 0) {
    return (
      <div style={{ padding: '12px', color: '#6c757d' }}>
        No configurations available. Create configurations in the API first.
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', padding: '12px' }}>
      <div style={{ marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
        Environment Configurations ({selectedConfigs.length} selected)
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {configurations.map((config) => (
          <label
            key={config.configId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: selectedConfigs.includes(config.configId) ? '#e7f5ff' : '#ffffff',
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <input
              type="checkbox"
              checked={selectedConfigs.includes(config.configId)}
              onChange={() => handleToggle(config.configId)}
              disabled={disabled}
              style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: '14px' }}>{config.name}</div>
              <div style={{ fontSize: '12px', color: '#6c757d' }}>
                {[config.browser, config.os, config.device, config.resolution]
                  .filter(Boolean)
                  .join(' • ')}
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
