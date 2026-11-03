import {
  assertPermissionConstantsInCatalogue,
  IDENTITY_PERMISSIONS,
  PERMISSION_CATALOGUE,
  isCataloguePermissionCode,
} from './permission-catalogue';

describe('permission catalogue', () => {
  it('keeps typed constants aligned with the JSON catalogue', () => {
    expect(() => assertPermissionConstantsInCatalogue()).not.toThrow();
  });

  it('includes identity.role.manage for RBAC admin APIs', () => {
    expect(isCataloguePermissionCode(IDENTITY_PERMISSIONS.ROLE_MANAGE)).toBe(
      true,
    );
    expect(
      PERMISSION_CATALOGUE.some(
        (entry) => entry.code === IDENTITY_PERMISSIONS.ROLE_MANAGE,
      ),
    ).toBe(true);
  });
});
