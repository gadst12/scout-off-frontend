/** @jest-environment node */
jest.mock('@/lib/referralStore', () => ({
  generateCode: jest.fn(),
}));
jest.mock('@/lib/sessionStore', () => ({
  getValidSession: jest.fn(),
}));

import { POST } from '../../../../app/api/referrals/generate/route';
import { NextRequest } from 'next/server';
import { generateCode } from '@/lib/referralStore';
import { getValidSession } from '@/lib/sessionStore';

const mockGenerateCode = generateCode as jest.Mock;
const mockGetValidSession = getValidSession as jest.Mock;

const SESSION_ID = 'session-abc-123';
const SCOUT_WALLET = 'GSCOUTWALLET00000000000000000000000000000000000000000000';

function makeRequest(cookieHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (cookieHeader) headers['cookie'] = cookieHeader;
  return new NextRequest('http://localhost:3000/api/referrals/generate', {
    method: 'POST',
    headers,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/referrals/generate', () => {
  it('returns 401 when there is no session cookie', async () => {
    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(mockGetValidSession).not.toHaveBeenCalled();
    expect(mockGenerateCode).not.toHaveBeenCalled();
  });

  it('returns 401 when the session cookie does not resolve to a valid session', async () => {
    mockGetValidSession.mockReturnValue(null);

    const res = await POST(makeRequest(`session=${SESSION_ID}`));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(mockGenerateCode).not.toHaveBeenCalled();
  });

  it('generates a code for the authenticated scout and returns it', async () => {
    mockGetValidSession.mockReturnValue({
      id: SESSION_ID,
      publicKey: SCOUT_WALLET,
      createdAt: 1700000000000,
      expiresAt: 1700086400000,
      revoked: false,
    });
    const referral = {
      code: 'SCOUT-AB12CD',
      scoutWallet: SCOUT_WALLET,
      createdAt: 1700000000000,
      usedBy: null,
      usedAt: null,
    };
    mockGenerateCode.mockReturnValue(referral);

    const res = await POST(makeRequest(`session=${SESSION_ID}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(referral);
    expect(mockGenerateCode).toHaveBeenCalledWith(SCOUT_WALLET);
  });

  it('passes the wallet resolved from the session, not the raw cookie value', async () => {
    mockGetValidSession.mockReturnValue({
      id: SESSION_ID,
      publicKey: SCOUT_WALLET,
      createdAt: 1700000000000,
      expiresAt: 1700086400000,
      revoked: false,
    });
    mockGenerateCode.mockReturnValue({
      code: 'SCOUT-ZZ99YY',
      scoutWallet: SCOUT_WALLET,
      createdAt: 1700000000000,
      usedBy: null,
      usedAt: null,
    });

    await POST(makeRequest(`session=${SESSION_ID}`));

    expect(mockGetValidSession).toHaveBeenCalledWith(SESSION_ID);
    expect(mockGenerateCode).toHaveBeenCalledTimes(1);
    expect(mockGenerateCode).toHaveBeenCalledWith(SCOUT_WALLET);
    expect(mockGenerateCode).not.toHaveBeenCalledWith(SESSION_ID);
  });
});
