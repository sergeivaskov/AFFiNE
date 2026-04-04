import { forwardRef } from 'react';

import * as styles from './kimai-error-banner.css';

export interface KimaiErrorBannerProps {
  /**
   * The type of error: 'schema_not_found' | 'connection_error'
   */
  errorType: 'schema_not_found' | 'connection_error';
  /**
   * Callback to retry the action
   */
  onRetry?: () => void;
}

/**
 * A banner component to show when Kimai is unavailable (Degraded Mode) or when the schema is not found (Provisioning). It should use standard notification/toast or a simple banner UI.
 */
export const KimaiErrorBanner = forwardRef<
  HTMLDivElement,
  KimaiErrorBannerProps
>((props, ref) => {
  const { ...rest } = props;

  return (
    <div ref={ref} className={styles.root} {...rest}>
      {/* Component implementation */}
      KimaiErrorBanner Component
    </div>
  );
});

KimaiErrorBanner.displayName = 'KimaiErrorBanner';
