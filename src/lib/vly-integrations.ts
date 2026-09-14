// VLY Integrations Configuration
// See /integrations.md for usage documentation
//
// NOTE: @vly-ai/integrations silently substitutes a built-in default token
// when deploymentToken is empty, which masks missing configuration as a
// confusing 401 from the gateway. Callers must validate the key is present
// (see getDeploymentToken) before making requests.

import { createVlyIntegrations } from '@vly-ai/integrations';

export const vly = createVlyIntegrations({
  deploymentToken: process.env.VLY_INTEGRATION_KEY,
  debug: process.env.NODE_ENV === 'development'
});

/**
 * Returns the configured VLY integration key, throwing a clear error when it
 * is missing. Never logs or returns the key value to the client.
 */
export function getDeploymentToken(): string {
  const token = process.env.VLY_INTEGRATION_KEY?.trim();
  if (!token) {
    throw new Error(
      "VLY_INTEGRATION_KEY is not configured on this deployment. " +
        "Add it in the project's Keys/API keys settings and try again.",
    );
  }
  return token;
}
