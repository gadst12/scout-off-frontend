/** @jest-environment node */
jest.mock('@/lib/referralStore', () => ({
  getReferralCount: jest.fn(),
  getCodesByScout: jest.fn(),
}));
jest.mock('@/lib/sessionStore', () => ({
  getValidSession: jest.fn(),
}));

import { GET } from '../../../../app/api/referrals/count/route';
import { NextRequest } from 'next/server';
import { getReferralCount, getCodesByScout } from '@/lib/referralStore';
import { getValidSession } from '@/lib/sessionStore';

const mockGetReferralCount = getReferralCount as jest.Mock;
const mockGetCodesByScout = getCodesByScout as jest.Mock;
const mockGetValidSession = getValidSession as jest.Mock;

const SESSION_ID = 'session-abc-123';
const SCOUT_WALLET = 'GSCOUTWALLET00000000000000000000000000000000000000000000';
const VALID_SESSION = {
  id: SESSION_ID,
  publicKey: SCOUT_WALLET,
  createdAt: 1700000000000,
  expiresAt: 1700086400000,
  revoked: false,
};

function makeRequest(cookieHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (cookieHeader) headers['cookie'] = cookieHeader;
  return new NextRequest('http://localhost:3000/api/referrals/count', {
    method: 'GET',
    headers,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/referrals/count', () => {
  it('returns 401 when there is no session cookie', async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(mockGetValidSession).not.toHaveBeenCalled();
    expect(mockGetCodesByScout).not.toHaveBeenCalled();
    expect(mockGetReferralCount).not.toHaveBeenCalled();
  });

  it('returns 401 when the session cookie does not resolve to a valid session', async () => {
    mockGetValidSession.mockReturnValue(null);

    const res = await GET(makeRequest(`session=${SESSION_ID}`));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(mockGetCodesByScout).not.toHaveBeenCalled();
    expect(mockGetReferralCount).not.toHaveBeenCalled();
  });

  it('returns totalCodes and successfulReferrals for the authenticated scout', async () => {
    mockGetValidSession.mockReturnValue(VALID_SESSION);
    mockGetCodesByScout.mockReturnValue([
      {
        code: 'SCOUT-AAA111',
        scoutWallet: SCOUT_WALLET,
        createdAt: 1,
        usedBy: null,
        usedAt: null,
      },
      {
        code: 'SCOUT-BBB222',
        scoutWallet: SCOUT_WALLET,
        createdAt: 2,
        usedBy: 'GX',
        usedAt: 3,
      },
      {
        code: 'SCOUT-CCC333',
        scoutWallet: SCOUT_WALLET,
        createdAt: 4,
        usedBy: 'GY',
        usedAt: 5,
      },
    ]);
    mockGetReferralCount.mockReturnValue(2);

    const res = await GET(makeRequest(`session=${SESSION_ID}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      totalCodes: 3,
      successfulReferrals: 2,
    });
    expect(mockGetCodesByScout).toHaveBeenCalledWith(SCOUT_WALLET);
    expect(mockGetReferralCount).toHaveBeenCalledWith(SCOUT_WALLET);
  });

  it('returns zeros for a scout with no codes generated yet', async () => {
    mockGetValidSession.mockReturnValue(VALID_SESSION);
    mockGetCodesByScout.mockReturnValue([]);
    mockGetReferralCount.mockReturnValue(0);

    const res = await GET(makeRequest(`session=${SESSION_ID}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      totalCodes: 0,
      successfulReferrals: 0,
    });
  });
});
