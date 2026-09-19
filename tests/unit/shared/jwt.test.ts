import jwt from 'jsonwebtoken';
import { env } from '../../../src/config/env';
import { UnauthorizedError } from '../../../src/shared/errors';
import { signAuthToken, verifyAuthToken } from '../../../src/shared/jwt';
import { Role } from '../../../src/shared/roles';

describe('jwt', () => {
  it('round-trips the user id and roles', () => {
    const token = signAuthToken('user-1', [Role.READER, Role.SELLER]);

    expect(verifyAuthToken(token)).toEqual({ userId: 'user-1', roles: [Role.READER, Role.SELLER] });
  });

  it('defaults to the reader role when signing without roles', () => {
    expect(verifyAuthToken(signAuthToken('user-1')).roles).toEqual([Role.READER]);
  });

  it('treats tokens issued before roles existed as library-only', () => {
    const legacy = jwt.sign({ userId: 'old-user' }, env.JWT_SECRET);

    expect(verifyAuthToken(legacy)).toEqual({ userId: 'old-user', roles: [Role.READER] });
  });

  it('drops role claims it does not know', () => {
    const token = jwt.sign({ userId: 'u', roles: ['reader', 'root'] }, env.JWT_SECRET);

    expect(verifyAuthToken(token).roles).toEqual([Role.READER]);
  });

  it.each([
    ['garbage', 'not-a-token'],
    ['signed with another secret', jwt.sign({ userId: 'u' }, 'another-secret')],
    ['without a user id', jwt.sign({ roles: ['reader'] }, env.JWT_SECRET)],
    ['expired', jwt.sign({ userId: 'u' }, env.JWT_SECRET, { expiresIn: -10 })],
  ])('rejects a token that is %s', (_label, token) => {
    expect(() => verifyAuthToken(token)).toThrow(UnauthorizedError);
    try {
      verifyAuthToken(token);
    } catch (error) {
      expect((error as UnauthorizedError).code).toBe('INVALID_TOKEN');
    }
  });
});
