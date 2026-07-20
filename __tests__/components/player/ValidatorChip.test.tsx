import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/contract', () => ({
  checkIsValidator: jest.fn(),
}));
jest.mock('@/lib/api', () => ({
  fetchValidatorMilestoneCount: jest.fn(),
}));

import { checkIsValidator } from '@/lib/contract';
import { fetchValidatorMilestoneCount } from '@/lib/api';
import ValidatorChip from '@/components/player/ValidatorChip';

const mockCheckIsValidator = checkIsValidator as jest.Mock;
const mockFetchCount = fetchValidatorMilestoneCount as jest.Mock;

const ADDRESS = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQR';

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ValidatorChip — loading state', () => {
  it('exposes a "Fetching validator information…" accessible name before the calls resolve', () => {
    mockCheckIsValidator.mockReturnValue(new Promise(() => {})); // never resolves
    mockFetchCount.mockReturnValue(new Promise(() => {}));

    render(<ValidatorChip address={ADDRESS} />);

    expect(
      screen.getByRole('generic', {
        name: 'Fetching validator information…',
      }),
    ).toBeInTheDocument();
  });

  it('renders the truncated address text while loading', () => {
    mockCheckIsValidator.mockReturnValue(new Promise(() => {}));
    mockFetchCount.mockReturnValue(new Promise(() => {}));

    render(<ValidatorChip address={ADDRESS} />);

    expect(screen.getByText('GABCDEFG…OPQR')).toBeInTheDocument();
    // Status text is only shown once resolved — not during loading.
    expect(screen.queryByText('Active validator')).not.toBeInTheDocument();
    expect(screen.queryByText('Former validator')).not.toBeInTheDocument();
  });
});

describe('ValidatorChip — active validator', () => {
  beforeEach(() => {
    mockCheckIsValidator.mockResolvedValue(true);
    mockFetchCount.mockResolvedValue(5);
  });

  it('renders the truncated address and "Active validator" status text', async () => {
    render(<ValidatorChip address={ADDRESS} />);
    await flush();

    expect(screen.getByText('GABCDEFG…OPQR')).toBeInTheDocument();
    expect(screen.getByText('Active validator')).toBeInTheDocument();
  });

  it('exposes an accessible name combining status and milestone count', async () => {
    render(<ValidatorChip address={ADDRESS} />);
    await flush();

    expect(
      screen.getByRole('generic', {
        name: 'Active validator · 5 milestones approved',
      }),
    ).toBeInTheDocument();
  });

  it('uses singular "milestone" when the count is exactly 1', async () => {
    mockFetchCount.mockResolvedValue(1);
    render(<ValidatorChip address={ADDRESS} />);
    await flush();

    expect(
      screen.getByRole('generic', {
        name: 'Active validator · 1 milestone approved',
      }),
    ).toBeInTheDocument();
  });
});

describe('ValidatorChip — former validator', () => {
  it('renders "Former validator" status text when checkIsValidator resolves false', async () => {
    mockCheckIsValidator.mockResolvedValue(false);
    mockFetchCount.mockResolvedValue(2);

    render(<ValidatorChip address={ADDRESS} />);
    await flush();

    expect(screen.getByText('Former validator')).toBeInTheDocument();
    expect(
      screen.getByRole('generic', {
        name: 'Former validator · 2 milestones approved',
      }),
    ).toBeInTheDocument();
  });
});

describe('ValidatorChip — unknown status (checkIsValidator failure)', () => {
  it('falls back to "unknown" and hides the status text when checkIsValidator rejects', async () => {
    mockCheckIsValidator.mockRejectedValue(new Error('RPC unavailable'));
    mockFetchCount.mockResolvedValue(null);

    render(<ValidatorChip address={ADDRESS} />);
    await flush();

    // Status text is suppressed for both 'loading' and 'unknown' states.
    expect(screen.queryByText('Active validator')).not.toBeInTheDocument();
    expect(screen.queryByText('Former validator')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Validator status unknown'),
    ).not.toBeInTheDocument();

    // But the address is still shown, and the accessible name falls back to
    // "<status> · <truncated address>" since no milestone count is available.
    expect(screen.getByText('GABCDEFG…OPQR')).toBeInTheDocument();
    expect(
      screen.getByRole('generic', {
        name: 'Validator status unknown · GABCDEFG…OPQR',
      }),
    ).toBeInTheDocument();
  });

  it('still shows a milestone count in the accessible name if the indexer call succeeded independently', async () => {
    mockCheckIsValidator.mockRejectedValue(new Error('RPC unavailable'));
    mockFetchCount.mockResolvedValue(3);

    render(<ValidatorChip address={ADDRESS} />);
    await flush();

    expect(
      screen.getByRole('generic', {
        name: 'Validator status unknown · 3 milestones approved',
      }),
    ).toBeInTheDocument();
  });
});

describe('ValidatorChip — indexer unavailable (fetchValidatorMilestoneCount failure)', () => {
  it('still resolves validator status and falls back to address in the accessible name', async () => {
    mockCheckIsValidator.mockResolvedValue(true);
    // fetchValidatorMilestoneCount already swallows its own errors and
    // resolves null (per lib/api.ts), so simulate that contract here.
    mockFetchCount.mockResolvedValue(null);

    render(<ValidatorChip address={ADDRESS} />);
    await flush();

    expect(screen.getByText('Active validator')).toBeInTheDocument();
    expect(
      screen.getByRole('generic', {
        name: 'Active validator · GABCDEFG…OPQR',
      }),
    ).toBeInTheDocument();
  });
});

describe('ValidatorChip — truncation', () => {
  it('truncates a full 56-character address to first 8 + ellipsis + last 4', async () => {
    mockCheckIsValidator.mockResolvedValue(true);
    mockFetchCount.mockResolvedValue(0);

    render(<ValidatorChip address={ADDRESS} />);
    await flush();

    expect(screen.getByText('GABCDEFG…OPQR')).toBeInTheDocument();
  });
});

describe('ValidatorChip — tooltip behavior', () => {
  it('shows a tooltip with the full status/count text on hover and hides it on unhover', async () => {
    mockCheckIsValidator.mockResolvedValue(true);
    mockFetchCount.mockResolvedValue(5);
    const user = userEvent.setup();

    render(<ValidatorChip address={ADDRESS} />);
    await flush();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    const trigger = screen.getByRole('generic', {
      name: 'Active validator · 5 milestones approved',
    });
    await user.hover(trigger);

    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Active validator · 5 milestones approved',
    );

    await user.unhover(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows a "Fetching validator information…" tooltip while still loading', async () => {
    mockCheckIsValidator.mockReturnValue(new Promise(() => {}));
    mockFetchCount.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    render(<ValidatorChip address={ADDRESS} />);

    const trigger = screen.getByText('GABCDEFG…OPQR');
    await user.hover(trigger);

    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Fetching validator information…',
    );
  });
});
