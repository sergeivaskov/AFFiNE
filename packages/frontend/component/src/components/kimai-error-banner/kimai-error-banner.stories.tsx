import type { Meta, StoryObj } from '@storybook/react';

import { KimaiErrorBanner } from './kimai-error-banner';

const meta: Meta<typeof KimaiErrorBanner> = {
  title: 'Components/KimaiErrorBanner',
  component: KimaiErrorBanner,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof KimaiErrorBanner>;

export const Default: Story = {
  args: {
    // Add default props here
  },
};
