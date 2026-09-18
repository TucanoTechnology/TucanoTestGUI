import type {
  TestConfiguration,
  TestConfigurationCreateRequest,
  TestConfigurationUpdateRequest,
} from "../../api/generated/index.js";
import type { ConfigurationFormValues } from "./ConfigurationForm.js";

/**
 * The body a create carries. The API rejects an unknown field and stores a
 * supplied empty string as the value, so a blank optional is left out.
 *
 * The key the project lists the configuration under is derived from `name`
 * with `.json` appended, and `configId` in the body does not change it: it is
 * written into the document instead, where it resolves to nothing. The form
 * offers no such field, and this builder sends none.
 */
export function buildConfigurationCreateRequest(
  values: ConfigurationFormValues,
): TestConfigurationCreateRequest {
  return {
    name: values.name,
    ...(values.browser ? { browser: values.browser } : {}),
    ...(values.os ? { os: values.os } : {}),
    ...(values.device ? { device: values.device } : {}),
    ...(values.resolution ? { resolution: values.resolution } : {}),
  };
}

/**
 * Only the fields the user changed: the API replaces the fields the body
 * carries and keeps every field it does not, so an emptied one is sent as an
 * empty string to clear it and an untouched one is left out.
 *
 * `configId` is never one of them. The API writes a body `configId` into the
 * document without moving the configuration, which would leave the resource
 * answering under its key while storing an identifier that resolves to
 * nothing, and a rename never moves the key either way.
 */
export function buildConfigurationUpdateRequest(
  configuration: TestConfiguration,
  values: ConfigurationFormValues,
): TestConfigurationUpdateRequest {
  const requestBody: TestConfigurationUpdateRequest = {};

  if (values.name !== configuration.name) {
    requestBody.name = values.name;
  }
  if (values.browser !== (configuration.browser ?? "")) {
    requestBody.browser = values.browser;
  }
  if (values.os !== (configuration.os ?? "")) {
    requestBody.os = values.os;
  }
  if (values.device !== (configuration.device ?? "")) {
    requestBody.device = values.device;
  }
  if (values.resolution !== (configuration.resolution ?? "")) {
    requestBody.resolution = values.resolution;
  }

  return requestBody;
}
