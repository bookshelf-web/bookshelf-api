import { DEFAULT_ROLES, normalizeRoles, Role, SELF_SERVICE_ROLES } from '../../../src/shared/roles';

describe('roles', () => {
  it('never offers the admin role for self-service', () => {
    expect(SELF_SERVICE_ROLES).not.toContain(Role.ADMIN);
    expect([...SELF_SERVICE_ROLES].sort()).toEqual([Role.BUYER, Role.READER, Role.SELLER].sort());
  });

  it('defaults to library-only, as accounts were before roles existed', () => {
    expect(DEFAULT_ROLES).toEqual([Role.READER]);
  });

  describe('normalizeRoles', () => {
    it('removes duplicates', () => {
      expect(normalizeRoles([Role.READER, Role.READER])).toEqual([Role.READER]);
    });

    it('lets a seller also buy', () => {
      expect(normalizeRoles([Role.SELLER]).sort()).toEqual([Role.BUYER, Role.SELLER].sort());
    });

    it('does not add roles nobody asked for', () => {
      expect(normalizeRoles([Role.BUYER])).toEqual([Role.BUYER]);
      expect(normalizeRoles([])).toEqual([]);
    });

    it('keeps a seller that is already a buyer as a two-role set', () => {
      expect(normalizeRoles([Role.BUYER, Role.SELLER])).toHaveLength(2);
    });
  });
});
