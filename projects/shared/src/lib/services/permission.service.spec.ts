import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { PermissionService } from './permission.service';

describe('PermissionService', () => {
  let service: PermissionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PermissionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function loadSessionWith(permissions: string[]) {
    service.loadSession().subscribe();
    httpMock.expectOne('/api/v1/auth/me').flush({
      success: true,
      data: {
        id: 'u1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'Lawyer',
        permissions,
        branchId: null,
        twoFaEnabled: false,
      },
    });
  }

  it('unwraps the {success,data} envelope from GET /auth/me', () => {
    loadSessionWith(['leads.read.own']);
    expect(service.currentUser()?.name).toBe('Test User');
  });

  it('matches a granted 3-segment key exactly', () => {
    loadSessionWith(['matters.read.all']);
    expect(service.has('matters.read.all')).toBeTrue();
    expect(service.has('matters.read.own')).toBeFalse();
  });

  // Real bug this guards against: NAV_ITEMS/route `data.permission` use the coarser
  // `module.action` form (no scope), but granted permissions from the API are always
  // the full `module.action.scope` triple — an exact-only match made every nav item
  // and route guard permanently unreachable regardless of what a user was granted.
  it('matches a 2-segment module.action key against any granted scope', () => {
    loadSessionWith(['leads.read.own']);
    expect(service.has('leads.read')).toBeTrue();
  });

  it('does not match an unrelated permission with a shared prefix substring', () => {
    loadSessionWith(['leads.readonly.own']);
    expect(service.has('leads.read')).toBeFalse();
  });

  it('hasAny is true if any key matches (exact or prefix)', () => {
    loadSessionWith(['billing.read.branch']);
    expect(service.hasAny(['matters.read', 'billing.read'])).toBeTrue();
  });

  it('has() is false before a session is loaded', () => {
    expect(service.has('leads.read')).toBeFalse();
  });
});
